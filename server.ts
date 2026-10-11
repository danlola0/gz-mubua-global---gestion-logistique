import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/api.ts';
import { supabaseService } from './server/supabase.ts';
import { dbManager } from './server/db.ts';
import { requireSupabaseUser } from './server/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware JSON with body size limit for photo attachments
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  const isProduction = process.env.NODE_ENV === 'production';
  let initializationError: string | null = null;
  const supabaseReady = (async () => {
    if (!supabaseService.isConfigured()) {
      throw new Error('Supabase non configuré. Vérifiez SUPABASE_URL et SUPABASE_ANON_KEY dans l’environnement du serveur.');
    }

    const connection = await supabaseService.testConnection();
    if (!connection.success || connection.tablesStatus !== 'ready') {
      throw new Error(`Initialisation Supabase impossible : ${connection.message}`);
    }

    const liveData = await supabaseService.fetchFromSupabase();
    if (!liveData) {
      throw new Error('Lecture de Supabase impossible. Vérifiez les droits d’accès aux tables.');
    }
    dbManager.applySupabaseData(liveData);
    console.log('[Supabase] Données chargées depuis la base distante.');
  })().catch((err) => {
    initializationError = err instanceof Error ? err.message : String(err);
    console.error('[Supabase] Initialisation échouée:', initializationError);
  });

  // The production container must bind its port immediately. Hold API requests
  // until the initial Supabase sync has finished, and return a useful error if it failed.
  app.use('/api', (_req, res, next) => {
    void supabaseReady.then(() => {
      if (initializationError) {
        res.status(503).json({ error: initializationError });
        return;
      }
      next();
    });
  });

  // Require a verified Supabase Auth session and application role on all API routes.
  app.use('/api', requireSupabaseUser);

  // Persist audit and notification changes made by API actions to Supabase too.
  app.use('/api', (req, res, next) => {
    const existing = dbManager.getData();
    const knownAuditLogIds = new Set(existing.auditLogs.map((log) => log.id));
    const knownNotificationReadStates = new Map(
      existing.notifications.map((notification) => [notification.id, notification.isRead])
    );

    res.once('finish', () => {
      if (res.statusCode >= 400) return;

      const updated = dbManager.getData();
      const newLogs = updated.auditLogs.filter((log) => !knownAuditLogIds.has(log.id));
      const changedNotifications = updated.notifications.filter(
        (notification) =>
          !knownNotificationReadStates.has(notification.id) ||
          knownNotificationReadStates.get(notification.id) !== notification.isRead
      );

      void Promise.all([
        ...newLogs.map((log) => supabaseService.upsertAuditLog(log)),
        ...changedNotifications.map((notification) => supabaseService.upsertNotification(notification)),
      ]).catch((err) => console.error('[Supabase audit/notification sync]', err));
    });

    next();
  });

  // Register API routes before any static SPA fallback can capture /api requests.
  app.use('/api', apiRouter);

  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    app.use((await createViteServer({ server: { middlewareMode: true }, appType: 'spa' })).middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GZ MUBUA GLOBAL Freight & Logistics Platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
