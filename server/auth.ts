import type { NextFunction, Request, Response } from 'express';
import { supabase } from './supabase.ts';
import type { UserRole } from '../src/types/index.ts';

export interface AuthenticatedRequest extends Request {
  appUser?: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    agencyId: string;
    agencyName: string;
    status: 'active' | 'inactive';
  };
}

const roleMatrix: Record<string, Partial<Record<string, UserRole[]>>> = {
  users: { GET: ['admin'], POST: ['admin'], PUT: ['admin'], DELETE: ['admin'] },
  agencies: { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier', 'client'] },
  'exchange-rates': { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier', 'client'], PUT: ['admin'] },
  stats: { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier'] },
  'audit-logs': { GET: ['admin'] },
  notifications: { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier', 'client'], POST: ['admin', 'china_team', 'kinshasa_team', 'cashier', 'client'] },
  clients: { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier'], POST: ['admin', 'china_team', 'kinshasa_team', 'cashier'], PUT: ['admin'], DELETE: ['admin'] },
  parcels: { GET: ['admin', 'china_team', 'kinshasa_team', 'client'], POST: ['admin', 'china_team'], PUT: ['admin'], DELETE: ['admin'] },
  shipments: { GET: ['admin', 'china_team', 'kinshasa_team'], POST: ['admin', 'china_team'], PUT: ['admin', 'china_team'], DELETE: ['admin'] },
  payments: { GET: ['admin', 'cashier', 'client'], POST: ['admin', 'cashier'], DELETE: ['admin', 'cashier'] },
  expenses: { GET: ['admin', 'cashier'], POST: ['admin', 'cashier'], PUT: ['admin'], DELETE: ['admin'] },
  employees: { GET: ['admin'], POST: ['admin'], PUT: ['admin'], DELETE: ['admin'] },
  salaries: { GET: ['admin'], POST: ['admin'], DELETE: ['admin'] },
  supabase: { GET: ['admin'], POST: ['admin'] },
};

function routePermission(path: string, method: string): UserRole[] | undefined {
  const segments = path.split('/').filter(Boolean);
  const root = segments[0];
  if (root === 'track') return undefined;

  if (root === 'parcels' && segments[2] === 'status' && method === 'POST') {
    return ['admin', 'china_team', 'kinshasa_team'];
  }
  if (root === 'shipments' && segments[2] === 'depart' && method === 'POST') {
    return ['admin', 'china_team'];
  }
  if (root === 'shipments' && segments[2] === 'arrive' && method === 'POST') {
    return ['admin', 'kinshasa_team'];
  }
  if (root === 'shipments' && segments[2] === 'parcels' && method === 'POST') {
    return ['admin', 'china_team'];
  }

  const rules = roleMatrix[root];
  return rules?.[method];
}

export async function requireSupabaseUser(req: Request, res: Response, next: NextFunction) {
  // Public parcel tracking exposes only the sanitized response returned by its dedicated route.
  if (req.method === 'GET' && req.path.startsWith('/track/')) {
    next();
    return;
  }

  if (!supabase) {
    res.status(503).json({ error: 'Authentification Supabase indisponible.' });
    return;
  }

  const authorization = req.header('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Session Supabase requise.' });
    return;
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(match[1]);
    if (authError || !authData.user) {
      res.status(401).json({ error: 'Session Supabase invalide ou expirée.' });
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, username, full_name, email, phone, role, agency_id, agency_name, status, auth_user_id')
      .eq('auth_user_id', authData.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (profileError || !profile || profile.auth_user_id !== authData.user.id) {
      res.status(403).json({ error: 'Aucun profil applicatif actif n’est associé à cette session.' });
      return;
    }

    const allowedRoles = routePermission(req.path.replace(/^\//, ''), req.method);
    if (!allowedRoles || !allowedRoles.includes(profile.role as UserRole)) {
      res.status(403).json({ error: 'Votre rôle ne permet pas cette opération.' });
      return;
    }

    const authenticatedRequest = req as AuthenticatedRequest;
    authenticatedRequest.appUser = {
      id: profile.id,
      username: profile.username,
      fullName: profile.full_name,
      email: profile.email || '',
      phone: profile.phone || '',
      role: profile.role as UserRole,
      agencyId: profile.agency_id || '',
      agencyName: profile.agency_name || '',
      status: profile.status,
    };

    // Ignore identity and role assertions sent by the browser; use the verified profile.
    req.body = req.body && typeof req.body === 'object' ? req.body : {};
    req.body.userId = profile.id;
    req.body.userName = profile.full_name;
    req.body.userRole = profile.role;
    req.body.agencyName = profile.agency_name;

    next();
  } catch (error) {
    console.error('[Supabase Auth] Token verification failed:', error);
    res.status(503).json({ error: 'Vérification de la session impossible. Réessayez.' });
  }
}
