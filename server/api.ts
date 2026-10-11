import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbManager } from './db.ts';
import { supabaseService } from './supabase.ts';
import type { AuthenticatedRequest } from './auth.ts';
import type {
  Parcel,
  Shipment,
  Client,
  Payment,
  Expense,
  Employee,
  SalaryPayment,
  ParcelStatus,
  User,
} from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// --- Auth Routes ---
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = dbManager.getData();
  const user = db.users.find(
    (u) => u.username.toLowerCase() === (username || '').toLowerCase()
  );

  if (!user) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }

  // Demo simplicity: check password or match default
  if (password && user.password && user.password !== password) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  dbManager.addAuditLog(
    { id: user.id, name: user.fullName, role: user.role, agencyName: user.agencyName },
    'LOGIN',
    'USER',
    user.id,
    `Connexion de l’utilisateur ${user.fullName} (${user.role})`
  );
  dbManager.save();

  const { password: _, ...userSafe } = user;
  res.json({ success: true, user: userSafe });
});

router.get('/users', (req, res) => {
  const db = dbManager.getData();
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

router.post('/users', async (req, res) => {
  const db = dbManager.getData();
  const newUser: User = {
    id: `USR-${Date.now()}`,
    username: req.body.username,
    password: req.body.password || 'password123',
    fullName: req.body.fullName,
    email: req.body.email,
    phone: req.body.phone,
    role: req.body.role,
    agencyId: req.body.agencyId,
    agencyName: req.body.agencyName || 'Siège Kinshasa Gombe',
    status: req.body.status || 'active',
    createdAt: new Date().toISOString().split('T')[0],
  };

  db.users.push(newUser);
  dbManager.addAuditLog(
    { id: 'USR-ADMIN', name: 'Administrateur', role: 'admin' },
    'CREATE',
    'USER',
    newUser.id,
    `Création de l’utilisateur ${newUser.fullName} avec rôle ${newUser.role}`
  );
  dbManager.save();
  await supabaseService.upsertUser(newUser).catch((e) => console.error('[Supabase upsertUser]', e));
  const { password, ...safe } = newUser;
  res.json(safe);
});

router.put('/users/:id', async (req, res) => {
  const db = dbManager.getData();
  const index = db.users.findIndex((u) => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  db.users[index] = {
    ...db.users[index],
    ...req.body,
  };
  dbManager.save();
  await supabaseService.upsertUser(db.users[index]).catch((e) => console.error('[Supabase upsertUser]', e));
  const { password, ...safe } = db.users[index];
  res.json(safe);
});

router.delete('/users/:id', async (req, res) => {
  const db = dbManager.getData();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  try {
    await supabaseService.deleteUser(req.params.id);
    dbManager.deleteUser(req.params.id);
    dbManager.addAuditLog(
      { id: req.body.userId || 'USR-ADMIN', name: req.body.userName || 'Direction', role: 'admin' },
      'DELETE',
      'USER',
      user.id,
      `Suppression définitive de l’utilisateur ${user.fullName} (${user.username})`
    );
    dbManager.save();
    res.json({ success: true, message: `Utilisateur ${user.fullName} supprimé.` });
  } catch (err: any) {
    res.status(500).json({ error: `Erreur lors de la suppression : ${err.message}` });
  }
});

// --- Agencies ---
router.get('/agencies', (req, res) => {
  res.json(dbManager.getData().agencies);
});

// --- Exchange Rates ---
router.get('/exchange-rates', (req, res) => {
  res.json(dbManager.getData().exchangeRates);
});

router.put('/exchange-rates', async (req, res) => {
  const db = dbManager.getData();
  const { USD, CNY, CDF, AOA } = req.body;
  const old = { ...db.exchangeRates };
  db.exchangeRates = {
    USD: Number(USD) || 1,
    CNY: Number(CNY) || 7.25,
    CDF: Number(CDF) || 2850,
    AOA: Number(AOA) || 920,
    lastUpdated: new Date().toISOString().split('T')[0],
  };
  dbManager.addAuditLog(
    { id: 'USR-ADMIN', name: 'Administrateur', role: 'admin' },
    'UPDATE',
    'SETTINGS',
    'EXCHANGE_RATES',
    'Mise à jour des taux de change multi-devises',
    old,
    db.exchangeRates
  );
  dbManager.save();
  await supabaseService.upsertExchangeRates(db.exchangeRates).catch((e) => console.error('[Supabase rates]', e));
  res.json(db.exchangeRates);
});

// --- Dashboard & Analytics ---
router.get('/stats', (req, res) => {
  res.json(dbManager.getDashboardStats());
});

// --- Audit Logs ---
router.get('/audit-logs', (req, res) => {
  res.json(dbManager.getData().auditLogs);
});

// --- Notifications ---
router.get('/notifications', (req, res) => {
  const role = (req as AuthenticatedRequest).appUser?.role;
  const notifications = dbManager.getData().notifications.filter(
    (notification) => notification.targetRole === 'ALL' || notification.targetRole === role
  );
  res.json(notifications);
});

router.post('/notifications/mark-read', (req, res) => {
  const { id } = req.body;
  const db = dbManager.getData();
  if (id === 'all') {
    if ((req as AuthenticatedRequest).appUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Seul un administrateur peut marquer toutes les notifications.' });
    }
    db.notifications.forEach((n) => (n.isRead = true));
  } else {
    const notif = db.notifications.find((n) => n.id === id);
    const role = (req as AuthenticatedRequest).appUser?.role;
    if (!notif || (notif.targetRole !== 'ALL' && notif.targetRole !== role)) {
      return res.status(404).json({ error: 'Notification non trouvée.' });
    }
    notif.isRead = true;
  }
  dbManager.save();
  res.json({ success: true });
});

// --- Clients ---
router.get('/clients', (req, res) => {
  const db = dbManager.getData();
  // Ensure calculations are up to date
  db.clients.forEach((c) => dbManager.recalculateClient(c.id));
  res.json(db.clients);
});

router.post('/clients', async (req, res) => {
  const db = dbManager.getData();
  const clientCount = db.clients.length + 1;
  const code = `CLI-${String(clientCount).padStart(3, '0')}`;

  const newClient: Client = {
    id: `CLI-${Date.now()}`,
    code,
    fullName: req.body.fullName,
    phone: req.body.phone,
    email: req.body.email || '',
    address: req.body.address || '',
    city: req.body.city || 'Kinshasa',
    country: req.body.country || 'RDC',
    totalParcels: 0,
    totalAmountUSD: 0,
    totalPaidUSD: 0,
    remainingBalanceUSD: 0,
    createdAt: new Date().toISOString().split('T')[0],
    notes: req.body.notes || '',
  };

  db.clients.unshift(newClient);
  dbManager.addAuditLog(
    { id: req.body.userId || 'USR-ADMIN', name: req.body.userName || 'Opérateur', role: req.body.userRole || 'admin' },
    'CREATE',
    'CLIENT',
    newClient.id,
    `Création du client ${newClient.fullName} (${newClient.phone})`
  );
  dbManager.save();
  await supabaseService.upsertClient(newClient).catch((e) => console.error('[Supabase upsertClient]', e));
  res.json(newClient);
});

router.put('/clients/:id', async (req, res) => {
  const db = dbManager.getData();
  const index = db.clients.findIndex((c) => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Client non trouvé' });

  const old = { ...db.clients[index] };
  db.clients[index] = {
    ...db.clients[index],
    ...req.body,
  };

  dbManager.recalculateClient(db.clients[index].id);
  dbManager.addAuditLog(
    { id: req.body.userId || 'USR-ADMIN', name: req.body.userName || 'Opérateur', role: req.body.userRole || 'admin' },
    'UPDATE',
    'CLIENT',
    req.params.id,
    `Modification fiche client ${db.clients[index].fullName}`,
    old,
    db.clients[index]
  );
  dbManager.save();
  await supabaseService.upsertClient(db.clients[index]).catch((e) => console.error('[Supabase upsertClient]', e));
  res.json(db.clients[index]);
});

router.delete('/clients/:id', async (req, res) => {
  const db = dbManager.getData();
  const client = db.clients.find((c) => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'Client non trouvé' });

  // Safety constraint: prevent deleting client with active parcels or payments
  const clientParcels = db.parcels.filter((p) => p.clientId === req.params.id);
  const clientPayments = db.payments.filter((pay) => pay.clientId === req.params.id);
  if (clientParcels.length > 0 || clientPayments.length > 0) {
    return res.status(400).json({
      error: `Suppression impossible : ce client possède ${clientParcels.length} colis et ${clientPayments.length} paiements enregistrés. Supprimez ou réassignez d'abord ces éléments.`
    });
  }

  try {
    await supabaseService.deleteClient(req.params.id);
    dbManager.deleteClient(req.params.id);
    dbManager.addAuditLog(
      { id: req.body.userId || 'USR-ADMIN', name: req.body.userName || 'Direction', role: 'admin' },
      'DELETE',
      'CLIENT',
      client.id,
      `Suppression définitive du client ${client.fullName} (${client.code}) de Supabase`
    );
    dbManager.save();
    res.json({ success: true, message: `Client ${client.fullName} supprimé définitivement.` });
  } catch (err: any) {
    res.status(500).json({ error: `Erreur suppression Supabase : ${err.message}` });
  }
});

// --- Parcels (Colis) ---
router.get('/parcels', (req, res) => {
  const db = dbManager.getData();
  const appUser = (req as AuthenticatedRequest).appUser;
  if (appUser?.role === 'client') {
    const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
    const phone = normalizePhone(appUser.phone);
    if (!phone) return res.json([]);
    return res.json(db.parcels.filter((parcel) => normalizePhone(parcel.clientPhone) === phone));
  }
  res.json(db.parcels);
});

router.post('/parcels', (req, res) => {
  const db = dbManager.getData();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

  // Auto-generate COL-2026-XXXXXX
  const nextSeq = db.parcels.length + 1;
  const trackingNumber = `COL-2026-${String(nextSeq).padStart(6, '0')}`;

  const weight = Number(req.body.weightKg) || 1;
  const l = Number(req.body.lengthCm) || 0;
  const w = Number(req.body.widthCm) || 0;
  const h = Number(req.body.heightCm) || 0;
  const calcCbm = l > 0 && w > 0 && h > 0 ? Number(((l * w * h) / 1000000).toFixed(3)) : Number(req.body.volumeCbm) || 0.05;

  const transportCostUSD = Number(req.body.transportCostUSD) || 0;
  const extraFeesUSD = Number(req.body.extraFeesUSD) || 0;
  const totalCostUSD = transportCostUSD + extraFeesUSD;
  const amountPaidUSD = Number(req.body.amountPaidUSD) || 0;
  const remainingAmountUSD = Math.max(0, totalCostUSD - amountPaidUSD);

  const initialStatus: ParcelStatus = req.body.status || 'COMMANDE_CREEE';

  const newParcel: Parcel = {
    id: `PAR-${Date.now()}`,
    trackingNumber,
    clientId: req.body.clientId,
    clientName: req.body.clientName,
    clientPhone: req.body.clientPhone,
    description: req.body.description,
    quantity: Number(req.body.quantity) || 1,
    weightKg: weight,
    lengthCm: l,
    widthCm: w,
    heightCm: h,
    volumeCbm: calcCbm,
    photos: req.body.photos || [],
    supplier: req.body.supplier || 'Fournisseur Chine',
    purchaseInfo: req.body.purchaseInfo || '',
    chinaReceptionAddress: req.body.chinaReceptionAddress || 'Entrepôt GZ MUBUA Hub Guangzhou',
    chinaReceptionDate: req.body.chinaReceptionDate || dateStr,
    chinaAgencyId: req.body.chinaAgencyId || 'AG-GZ',
    chinaAgencyName: req.body.chinaAgencyName || 'GZ MUBUA Hub Guangzhou',
    shipmentId: req.body.shipmentId || undefined,
    shipmentNumber: req.body.shipmentNumber || undefined,
    transportMode: req.body.transportMode || 'MARITIME',
    origin: req.body.origin || 'Guangzhou, Chine',
    destination: req.body.destination || 'Kinshasa',
    destinationAgencyId: req.body.destinationAgencyId || 'AG-LIMETE',
    destinationAgencyName: req.body.destinationAgencyName || 'Dépôt & Retrait Kinshasa Limete',
    status: initialStatus,
    statusHistory: [
      {
        id: `SH-${Date.now()}`,
        status: initialStatus,
        date: dateStr,
        time: timeStr,
        user: req.body.userName || 'Agent Chine',
        agency: req.body.chinaAgencyName || 'GZ MUBUA Hub Guangzhou',
        comment: req.body.comment || 'Création et enregistrement initial du colis dans le système',
      },
    ],
    pricingCurrency: req.body.pricingCurrency || 'USD',
    transportCostUSD,
    extraFeesUSD,
    totalCostUSD,
    amountPaidUSD,
    remainingAmountUSD,
    warehouseLocation: req.body.warehouseLocation || '',
    comments: req.body.comments || '',
    createdAt: dateStr,
    updatedAt: dateStr,
  };

  db.parcels.unshift(newParcel);

  // If initial advance payment provided, create payment record
  if (amountPaidUSD > 0) {
    const payReceipt = `REC-2026-${String(db.payments.length + 1).padStart(4, '0')}`;
    const payment: Payment = {
      id: `PAY-${Date.now()}`,
      receiptNumber: payReceipt,
      parcelId: newParcel.id,
      parcelTrackingNumber: newParcel.trackingNumber,
      clientId: newParcel.clientId,
      clientName: newParcel.clientName,
      type: 'AVANCE',
      originalAmount: amountPaidUSD,
      currency: 'USD',
      exchangeRate: 1,
      amountUSD: amountPaidUSD,
      paymentMethod: req.body.paymentMethod || 'ESPECES',
      date: dateStr,
      time: timeStr,
      agencyId: newParcel.chinaAgencyId,
      agencyName: newParcel.chinaAgencyName,
      cashierId: req.body.userId || 'USR-CHINE',
      cashierName: req.body.userName || 'Agent Chine',
      notes: `Acompte initial enregistré à la création du colis ${newParcel.trackingNumber}`,
    };
    db.payments.unshift(payment);
  }

  // Recalculate client
  dbManager.recalculateClient(newParcel.clientId);

  // Recalculate shipment if linked
  if (newParcel.shipmentId) {
    dbManager.recalculateShipment(newParcel.shipmentId);
  }

  dbManager.addAuditLog(
    { id: req.body.userId || 'USR-CHINE', name: req.body.userName || 'Agent Chine', role: req.body.userRole || 'china_team' },
    'CREATE',
    'PARCEL',
    newParcel.id,
    `Création du colis ${newParcel.trackingNumber} (${newParcel.weightKg} kg, ${newParcel.description}) pour ${newParcel.clientName}`
  );

  dbManager.addNotification(
    'PARCEL_CREATED',
    `Nouveau colis ${newParcel.trackingNumber}`,
    `Colis de ${newParcel.clientName} (${newParcel.weightKg}kg) enregistré pour destination ${newParcel.destination}.`,
    'ALL',
    newParcel.trackingNumber
  );

  dbManager.save();
  supabaseService.upsertParcel(newParcel).catch((e) => console.error('[Supabase async sync]', e));
  res.json(newParcel);
});

// Update parcel status with full history logging
router.post('/parcels/:id/status', (req, res) => {
  const db = dbManager.getData();
  const parcel = db.parcels.find((p) => p.id === req.params.id);
  if (!parcel) return res.status(404).json({ error: 'Colis non trouvé' });

  const { status, comment, userName, userId, userRole, agencyName, warehouseLocation, deliveryDriverName, deliveryDriverPhone, deliveryRecipient } = req.body;
  const oldStatus = parcel.status;
  parcel.status = status;

  if (warehouseLocation) parcel.warehouseLocation = warehouseLocation;
  if (deliveryDriverName) parcel.deliveryDriverName = deliveryDriverName;
  if (deliveryDriverPhone) parcel.deliveryDriverPhone = deliveryDriverPhone;
  if (deliveryRecipient) {
    parcel.deliveryRecipient = deliveryRecipient;
    parcel.deliveryDate = new Date().toISOString().split('T')[0];
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

  parcel.updatedAt = dateStr;
  parcel.statusHistory.push({
    id: `SH-${Date.now()}`,
    status,
    date: dateStr,
    time: timeStr,
    user: userName || 'Opérateur',
    agency: agencyName,
    comment: comment || `Mise à jour du statut vers ${status}`,
  });

  dbManager.addAuditLog(
    { id: userId || 'USR-AGENT', name: userName || 'Opérateur', role: userRole || 'kinshasa_team', agencyName },
    'STATUS_CHANGE',
    'PARCEL',
    parcel.id,
    `Colis ${parcel.trackingNumber}: passage de ${oldStatus} à ${status}. ${comment || ''}`,
    oldStatus,
    status
  );

  // Notifications based on status
  if (status === 'DISPONIBLE_AGENCE') {
    dbManager.addNotification(
      'PARCEL_READY',
      `Colis ${parcel.trackingNumber} prêt pour retrait`,
      `Le colis de ${parcel.clientName} est disponible à l'agence ${agencyName || parcel.destinationAgencyName}.`,
      'kinshasa_team',
      parcel.trackingNumber
    );
  } else if (status === 'LIVRE' || status === 'RETIRE_CLIENT') {
    dbManager.addNotification(
      'PARCEL_DELIVERED',
      `Colis ${parcel.trackingNumber} délivré`,
      `Colis clôturé et réceptionné par ${deliveryRecipient || parcel.clientName}.`,
      'ALL',
      parcel.trackingNumber
    );
  } else if (status === 'ANOMALIE') {
    dbManager.addNotification(
      'ANOMALY',
      `Anomalie signalée sur ${parcel.trackingNumber}`,
      `Attention: problème signalé sur le colis de ${parcel.clientName}: ${comment || 'Non spécifié'}.`,
      'ALL',
      parcel.trackingNumber
    );
  }

  dbManager.save();
  supabaseService.upsertParcel(parcel).catch((e) => console.error('[Supabase async sync]', e));
  res.json(parcel);
});

// Update parcel details
router.put('/parcels/:id', async (req, res) => {
  const db = dbManager.getData();
  const index = db.parcels.findIndex((p) => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Colis non trouvé' });

  const old = { ...db.parcels[index] };
  const updated = {
    ...db.parcels[index],
    ...req.body,
    updatedAt: new Date().toISOString().split('T')[0],
  };

  // Recalculate financials
  updated.totalCostUSD = (Number(updated.transportCostUSD) || 0) + (Number(updated.extraFeesUSD) || 0);
  updated.remainingAmountUSD = Math.max(0, updated.totalCostUSD - (Number(updated.amountPaidUSD) || 0));

  db.parcels[index] = updated;
  dbManager.recalculateParcel(updated.id);

  if (updated.shipmentId) {
    dbManager.recalculateShipment(updated.shipmentId);
  }

  dbManager.addAuditLog(
    { id: req.body.userId || 'USR-ADMIN', name: req.body.userName || 'Opérateur', role: req.body.userRole || 'admin' },
    'UPDATE',
    'PARCEL',
    updated.id,
    `Modification colis ${updated.trackingNumber}`,
    old,
    updated
  );
  dbManager.save();
  await supabaseService.upsertParcel(updated).catch((e) => console.error('[Supabase upsertParcel]', e));
  res.json(updated);
});

router.delete('/parcels/:id', async (req, res) => {
  const db = dbManager.getData();
  const parcel = db.parcels.find((p) => p.id === req.params.id);
  if (!parcel) return res.status(404).json({ error: 'Colis non trouvé' });

  // Safety check: verify no payments attached
  const parcelPayments = db.payments.filter((pay) => pay.parcelId === req.params.id);
  if (parcelPayments.length > 0) {
    return res.status(400).json({
      error: `Suppression impossible : ce colis possède ${parcelPayments.length} reçu(s) de paiement enregistré(s). Supprimez d’abord ces règlements en caisse.`
    });
  }

  try {
    await supabaseService.deleteParcel(req.params.id);
    dbManager.deleteParcel(req.params.id);
    dbManager.addAuditLog(
      { id: req.body.userId || 'USR-ADMIN', name: req.body.userName || 'Direction', role: 'admin' },
      'DELETE',
      'PARCEL',
      parcel.id,
      `Suppression définitive du colis ${parcel.trackingNumber} de Supabase`
    );
    dbManager.save();
    res.json({ success: true, message: `Colis ${parcel.trackingNumber} supprimé définitivement.` });
  } catch (err: any) {
    res.status(500).json({ error: `Erreur suppression Supabase : ${err.message}` });
  }
});

// Public / Client tracking endpoint
router.get('/track/:number', (req, res) => {
  const query = (req.params.number || '').trim().toUpperCase();
  const db = dbManager.getData();
  // A phone number is not a secret; never use it as a public lookup credential.
  const parcel = db.parcels.find((p) => p.trackingNumber.toUpperCase() === query);

  if (!parcel) {
    return res.status(404).json({ error: 'Aucun colis trouvé avec ce numéro de suivi.' });
  }

  // Sanitize internal confidential fields for public tracking view
  const publicView = {
    trackingNumber: parcel.trackingNumber,
    clientName: parcel.clientName,
    clientPhone: parcel.clientPhone ? parcel.clientPhone.slice(0, 7) + '****' : '',
    description: parcel.description,
    quantity: parcel.quantity,
    weightKg: parcel.weightKg,
    volumeCbm: parcel.volumeCbm,
    transportMode: parcel.transportMode,
    origin: parcel.origin,
    destination: parcel.destination,
    destinationAgencyName: parcel.destinationAgencyName,
    status: parcel.status,
    statusHistory: parcel.statusHistory,
    totalCostUSD: parcel.totalCostUSD,
    amountPaidUSD: parcel.amountPaidUSD,
    remainingAmountUSD: parcel.remainingAmountUSD,
    warehouseLocation: parcel.status === 'DISPONIBLE_AGENCE' ? parcel.warehouseLocation : undefined,
    deliveryDriverName: parcel.status === 'EN_COURS_LIVRAISON' ? parcel.deliveryDriverName : undefined,
    createdAt: parcel.createdAt,
    updatedAt: parcel.updatedAt,
  };

  res.json(publicView);
});

// --- Shipments (Expéditions) ---
router.get('/shipments', (req, res) => {
  const db = dbManager.getData();
  db.shipments.forEach((s) => dbManager.recalculateShipment(s.id));
  res.json(db.shipments);
});

router.post('/shipments', async (req, res) => {
  const db = dbManager.getData();
  const nextSeq = db.shipments.length + 1;
  const shipmentNumber = `EXP-2026-${String(nextSeq).padStart(5, '0')}`;
  const now = new Date().toISOString().split('T')[0];

  const newShipment: Shipment = {
    id: `SHIP-${Date.now()}`,
    shipmentNumber,
    departureAgencyId: req.body.departureAgencyId || 'AG-GZ',
    departureAgencyName: req.body.departureAgencyName || 'GZ MUBUA Hub Guangzhou',
    destination: req.body.destination || 'Kinshasa',
    destinationAgencyId: req.body.destinationAgencyId || 'AG-LIMETE',
    destinationAgencyName: req.body.destinationAgencyName || 'Dépôt & Retrait Kinshasa Limete',
    transportMode: req.body.transportMode || 'MARITIME',
    carrierName: req.body.carrierName || 'Cie Maritime / Aérienne',
    containerOrFlightNumber: req.body.containerOrFlightNumber || 'Non spécifié',
    departureDate: req.body.departureDate || now,
    estimatedArrivalDate: req.body.estimatedArrivalDate || '',
    parcelCount: 0,
    totalWeightKg: 0,
    totalVolumeCbm: 0,
    totalCostUSD: Number(req.body.totalCostUSD) || 0,
    status: 'EN_PREPARATION',
    parcelIds: req.body.parcelIds || [],
    comments: req.body.comments || '',
    createdAt: now,
    updatedAt: now,
  };

  db.shipments.unshift(newShipment);

  // If parcelIds given, link them
  if (Array.isArray(req.body.parcelIds) && req.body.parcelIds.length > 0) {
    db.parcels.forEach((p) => {
      if (req.body.parcelIds.includes(p.id)) {
        p.shipmentId = newShipment.id;
        p.shipmentNumber = newShipment.shipmentNumber;
        p.status = 'EXPEDITION_EN_PREPARATION';
        p.statusHistory.push({
          id: `SH-${Date.now()}-${p.id}`,
          status: 'EXPEDITION_EN_PREPARATION',
          date: now,
          time: new Date().toTimeString().split(' ')[0].substring(0, 5),
          user: req.body.userName || 'Agent Chine',
          agency: newShipment.departureAgencyName,
          comment: `Affecté à l'expédition ${newShipment.shipmentNumber}`,
        });
      }
    });
    dbManager.recalculateShipment(newShipment.id);
  }

  dbManager.addAuditLog(
    { id: req.body.userId || 'USR-CHINE', name: req.body.userName || 'Agent Chine', role: req.body.userRole || 'china_team' },
    'CREATE',
    'SHIPMENT',
    newShipment.id,
    `Création de l'expédition ${newShipment.shipmentNumber} (${newShipment.transportMode} vers ${newShipment.destination})`
  );
  try {
    await supabaseService.upsertShipment(newShipment);
  } catch (err: any) {
    return res.status(502).json({ error: `Échec d’enregistrement Supabase : ${err.message}` });
  }
  dbManager.save();
  res.json(newShipment);
});

// Link parcels to shipment
router.post('/shipments/:id/parcels', async (req, res) => {
  const db = dbManager.getData();
  const shipment = db.shipments.find((s) => s.id === req.params.id);
  if (!shipment) return res.status(404).json({ error: 'Expédition non trouvée' });

  const { parcelIds, userName, userId, userRole } = req.body;
  if (!Array.isArray(parcelIds)) return res.status(400).json({ error: 'parcelIds requis' });

  const now = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0].substring(0, 5);

  const updatedParcels: Parcel[] = [];
  db.parcels.forEach((p) => {
    if (parcelIds.includes(p.id)) {
      p.shipmentId = shipment.id;
      p.shipmentNumber = shipment.shipmentNumber;
      if (['COMMANDE_CREEE', 'ATTENTE_RECEPTION_CHINE', 'RECU_CHINE', 'IDENTIFIE', 'CONTROLE', 'PREPARE_EXPEDITION'].includes(p.status)) {
        p.status = 'EXPEDITION_EN_PREPARATION';
        p.statusHistory.push({
          id: `SH-${Date.now()}-${p.id}`,
          status: 'EXPEDITION_EN_PREPARATION',
          date: now,
          time,
          user: userName || 'Agent Chine',
          agency: shipment.departureAgencyName,
          comment: `Ajouté au conteneur / lot ${shipment.shipmentNumber}`,
        });
      }
      updatedParcels.push(p);
    }
  });

  dbManager.recalculateShipment(shipment.id);
  dbManager.addAuditLog(
    { id: userId || 'USR-CHINE', name: userName || 'Agent Chine', role: userRole || 'china_team' },
    'UPDATE',
    'SHIPMENT',
    shipment.id,
    `Ajout de ${parcelIds.length} colis à l'expédition ${shipment.shipmentNumber}`
  );
  dbManager.save();
  await supabaseService.upsertShipment(shipment).catch((e) => console.error('[Supabase shipment]', e));
  for (const up of updatedParcels) {
    supabaseService.upsertParcel(up).catch((e) => console.error('[Supabase parcel]', e));
  }
  res.json(shipment);
});

// Update shipment details
router.put('/shipments/:id', async (req, res) => {
  const db = dbManager.getData();
  const index = db.shipments.findIndex((s) => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Expédition non trouvée' });

  db.shipments[index] = {
    ...db.shipments[index],
    ...req.body,
    updatedAt: new Date().toISOString().split('T')[0],
  };

  dbManager.recalculateShipment(db.shipments[index].id);
  dbManager.save();
  await supabaseService.upsertShipment(db.shipments[index]).catch((e) => console.error('[Supabase upsertShipment]', e));
  res.json(db.shipments[index]);
});

// Delete shipment
router.delete('/shipments/:id', async (req, res) => {
  const db = dbManager.getData();
  const shipment = db.shipments.find((s) => s.id === req.params.id);
  if (!shipment) return res.status(404).json({ error: 'Expédition non trouvée' });

  try {
    await supabaseService.deleteShipment(req.params.id);
    dbManager.deleteShipment(req.params.id);
    dbManager.addAuditLog(
      { id: req.body.userId || 'USR-ADMIN', name: req.body.userName || 'Direction', role: 'admin' },
      'DELETE',
      'SHIPMENT',
      shipment.id,
      `Suppression définitive de l'expédition ${shipment.shipmentNumber}`
    );
    dbManager.save();
    res.json({ success: true, message: `Expédition ${shipment.shipmentNumber} supprimée définitivement.` });
  } catch (err: any) {
    res.status(500).json({ error: `Erreur suppression Supabase : ${err.message}` });
  }
});

// Mark shipment departed -> automatically updates all parcels to 'EXPEDIE' / 'EN_TRANSIT'
router.post('/shipments/:id/depart', async (req, res) => {
  const db = dbManager.getData();
  const shipment = db.shipments.find((s) => s.id === req.params.id);
  if (!shipment) return res.status(404).json({ error: 'Expédition non trouvée' });

  const { departureDate, userName, userId, userRole } = req.body;
  const now = departureDate || new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0].substring(0, 5);

  shipment.status = 'EXPEDIE';
  shipment.departureDate = now;
  shipment.updatedAt = now;

  const updatedParcels: Parcel[] = [];
  // Propagate to all linked parcels!
  db.parcels.forEach((p) => {
    if (p.shipmentId === shipment.id) {
      p.status = 'EXPEDIE';
      p.updatedAt = now;
      p.statusHistory.push({
        id: `SH-${Date.now()}-${p.id}`,
        status: 'EXPEDIE',
        date: now,
        time,
        user: userName || 'Agent Chine',
        agency: shipment.departureAgencyName,
        comment: `Départ de l'expédition ${shipment.shipmentNumber} (${shipment.transportMode}) avec ${shipment.carrierName}.`,
      });
      updatedParcels.push(p);
    }
  });

  dbManager.addAuditLog(
    { id: userId || 'USR-CHINE', name: userName || 'Agent Chine', role: userRole || 'china_team' },
    'STATUS_CHANGE',
    'SHIPMENT',
    shipment.id,
    `Départ validé pour ${shipment.shipmentNumber}. Tous les colis passent en statut EXPEDIE.`
  );

  dbManager.addNotification(
    'SHIPMENT_DEPARTED',
    `Expédition ${shipment.shipmentNumber} partie de Chine`,
    `${shipment.parcelCount} colis en route vers ${shipment.destination} (${shipment.transportMode}).`,
    'ALL'
  );

  dbManager.save();
  await supabaseService.upsertShipment(shipment).catch((e) => console.error('[Supabase shipment]', e));
  for (const up of updatedParcels) {
    supabaseService.upsertParcel(up).catch((e) => console.error('[Supabase parcel]', e));
  }
  res.json(shipment);
});

// Mark shipment arrived -> automatically updates all parcels to 'ARRIVE_DESTINATION'!
router.post('/shipments/:id/arrive', async (req, res) => {
  const db = dbManager.getData();
  const shipment = db.shipments.find((s) => s.id === req.params.id);
  if (!shipment) return res.status(404).json({ error: 'Expédition non trouvée' });

  const { actualArrivalDate, userName, userId, userRole, agencyName } = req.body;
  const now = actualArrivalDate || new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0].substring(0, 5);

  shipment.status = 'ARRIVE';
  shipment.actualArrivalDate = now;
  shipment.updatedAt = now;

  const updatedParcels: Parcel[] = [];
  // Propagate to all linked parcels!
  db.parcels.forEach((p) => {
    if (p.shipmentId === shipment.id) {
      p.status = 'ARRIVE_DESTINATION';
      p.updatedAt = now;
      p.statusHistory.push({
        id: `SH-${Date.now()}-${p.id}`,
        status: 'ARRIVE_DESTINATION',
        date: now,
        time,
        user: userName || 'Équipe Kinshasa',
        agency: agencyName || shipment.destinationAgencyName,
        comment: `Arrivée confirmée à destination (${shipment.destination}). Réception et contrôle en cours.`,
      });
      updatedParcels.push(p);
    }
  });

  dbManager.addAuditLog(
    { id: userId || 'USR-KIN', name: userName || 'Chef Dépôt', role: userRole || 'kinshasa_team', agencyName },
    'STATUS_CHANGE',
    'SHIPMENT',
    shipment.id,
    `Arrivée enregistrée pour ${shipment.shipmentNumber}. ${shipment.parcelCount} colis passent en ARRIVE_DESTINATION.`
  );

  dbManager.addNotification(
    'SHIPMENT_ARRIVED',
    `Expédition ${shipment.shipmentNumber} arrivée à destination!`,
    `Le conteneur / vol cargo est arrivé à ${shipment.destination}. Dépôtage et contrôle en cours.`,
    'ALL'
  );

  dbManager.save();
  await supabaseService.upsertShipment(shipment).catch((e) => console.error('[Supabase shipment]', e));
  for (const up of updatedParcels) {
    supabaseService.upsertParcel(up).catch((e) => console.error('[Supabase parcel]', e));
  }
  res.json(shipment);
});

// --- Payments / Caisse Recettes ---
router.get('/payments', (req, res) => {
  const db = dbManager.getData();
  const appUser = (req as AuthenticatedRequest).appUser;
  if (appUser?.role === 'client') {
    const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
    const phone = normalizePhone(appUser.phone);
    if (!phone) return res.json([]);
    const clientIds = new Set(
      db.clients.filter((client) => normalizePhone(client.phone) === phone).map((client) => client.id)
    );
    return res.json(db.payments.filter((payment) => clientIds.has(payment.clientId)));
  }
  res.json(db.payments);
});

router.post('/payments', async (req, res) => {
  const db = dbManager.getData();
  const now = new Date();
  const dateStr = req.body.date || now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

  const receiptNumber = `REC-2026-${String(db.payments.length + 1).padStart(4, '0')}`;

  const currency = req.body.currency || 'USD';
  const originalAmount = Number(req.body.originalAmount) || 0;
  const rates = db.exchangeRates;
  let exchangeRate = Number(req.body.exchangeRate);

  if (!exchangeRate || exchangeRate <= 0) {
    if (currency === 'USD') exchangeRate = 1;
    else if (currency === 'CNY') exchangeRate = rates.CNY;
    else if (currency === 'CDF') exchangeRate = rates.CDF;
    else if (currency === 'AOA') exchangeRate = rates.AOA;
    else exchangeRate = 1;
  }

  // Calculate amount in USD
  const amountUSD = currency === 'USD' ? originalAmount : Number((originalAmount / exchangeRate).toFixed(2));

  const newPayment: Payment = {
    id: `PAY-${Date.now()}`,
    receiptNumber,
    parcelId: req.body.parcelId || undefined,
    parcelTrackingNumber: req.body.parcelTrackingNumber || undefined,
    clientId: req.body.clientId,
    clientName: req.body.clientName,
    type: req.body.type || 'AVANCE',
    originalAmount,
    currency,
    exchangeRate,
    amountUSD,
    paymentMethod: req.body.paymentMethod || 'ESPECES',
    reference: req.body.reference || '',
    date: dateStr,
    time: timeStr,
    agencyId: req.body.agencyId || 'AG-GOMBE',
    agencyName: req.body.agencyName || 'Siège Kinshasa Gombe',
    cashierId: req.body.cashierId || req.body.userId || 'USR-CAISSE',
    cashierName: req.body.cashierName || req.body.userName || 'Caissier',
    notes: req.body.notes || '',
  };

  db.payments.unshift(newPayment);

  // Instantly recalculate linked parcel and client
  if (newPayment.parcelId) {
    dbManager.recalculateParcel(newPayment.parcelId);
  }
  dbManager.recalculateClient(newPayment.clientId);

  dbManager.addAuditLog(
    { id: newPayment.cashierId, name: newPayment.cashierName, role: 'cashier', agencyName: newPayment.agencyName },
    'PAYMENT',
    'PAYMENT',
    newPayment.id,
    `Encaissement de ${originalAmount} ${currency} (${amountUSD} USD) de ${newPayment.clientName} [Reçu ${receiptNumber}]`
  );

  dbManager.addNotification(
    'PAYMENT_RECEIVED',
    `Paiement reçu : ${originalAmount} ${currency}`,
    `Règlement ${receiptNumber} enregistré pour ${newPayment.clientName} (Équiv: ${amountUSD} $).`,
    'cashier'
  );

  dbManager.save();
  await supabaseService.upsertPayment(newPayment).catch((e) => console.error('[Supabase payment]', e));
  res.json(newPayment);
});

router.delete('/payments/:id', async (req, res) => {
  const db = dbManager.getData();
  const payment = db.payments.find((p) => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: 'Paiement non trouvé' });

  try {
    await supabaseService.deletePayment(req.params.id);
    dbManager.deletePayment(req.params.id);
    dbManager.addAuditLog(
      { id: req.body.userId || 'USR-ADMIN', name: req.body.userName || 'Direction', role: 'admin' },
      'DELETE',
      'PAYMENT',
      payment.id,
      `Suppression du reçu de paiement ${payment.receiptNumber} (${payment.originalAmount} ${payment.currency})`
    );
    dbManager.save();
    res.json({ success: true, message: `Reçu ${payment.receiptNumber} supprimé.` });
  } catch (err: any) {
    res.status(500).json({ error: `Erreur suppression Supabase : ${err.message}` });
  }
});

// --- Expenses / Dépenses ---
router.get('/expenses', (req, res) => {
  const db = dbManager.getData();
  res.json(db.expenses);
});

router.post('/expenses', async (req, res) => {
  const db = dbManager.getData();
  const now = new Date();
  const dateStr = req.body.date || now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

  const voucherNumber = `DEP-2026-${String(db.expenses.length + 1).padStart(4, '0')}`;
  const currency = req.body.currency || 'USD';
  const originalAmount = Number(req.body.originalAmount) || 0;
  const rates = db.exchangeRates;

  let exchangeRate = Number(req.body.exchangeRate);
  if (!exchangeRate || exchangeRate <= 0) {
    if (currency === 'USD') exchangeRate = 1;
    else if (currency === 'CNY') exchangeRate = rates.CNY;
    else if (currency === 'CDF') exchangeRate = rates.CDF;
    else if (currency === 'AOA') exchangeRate = rates.AOA;
    else exchangeRate = 1;
  }

  const amountUSD = currency === 'USD' ? originalAmount : Number((originalAmount / exchangeRate).toFixed(2));

  const newExpense: Expense = {
    id: `DEP-${Date.now()}`,
    voucherNumber,
    category: req.body.category || 'autres',
    categoryLabel: req.body.categoryLabel || req.body.category,
    originalAmount,
    currency,
    exchangeRate,
    amountUSD,
    agencyId: req.body.agencyId || 'AG-GOMBE',
    agencyName: req.body.agencyName || 'Siège Kinshasa Gombe',
    country: req.body.country || 'RDC',
    beneficiary: req.body.beneficiary || 'Bénéficiaire',
    date: dateStr,
    time: timeStr,
    recordedBy: req.body.recordedBy || req.body.userName || 'Gestionnaire Caisse',
    description: req.body.description || '',
    attachmentName: req.body.attachmentName,
    attachmentUrl: req.body.attachmentUrl,
  };

  db.expenses.unshift(newExpense);

  dbManager.addAuditLog(
    { id: req.body.userId || 'USR-CAISSE', name: newExpense.recordedBy, role: req.body.userRole || 'cashier', agencyName: newExpense.agencyName },
    'EXPENSE',
    'EXPENSE',
    newExpense.id,
    `Décaissement dépense [${voucherNumber}] de ${originalAmount} ${currency} (${amountUSD} USD) - Motif: ${newExpense.description}`
  );
  dbManager.save();
  await supabaseService.upsertExpense(newExpense).catch((e) => console.error('[Supabase expense]', e));
  res.json(newExpense);
});

router.put('/expenses/:id', async (req, res) => {
  const db = dbManager.getData();
  const index = db.expenses.findIndex((e) => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Dépense non trouvée' });

  db.expenses[index] = {
    ...db.expenses[index],
    ...req.body,
  };
  dbManager.save();
  await supabaseService.upsertExpense(db.expenses[index]).catch((e) => console.error('[Supabase expense]', e));
  res.json(db.expenses[index]);
});

router.delete('/expenses/:id', async (req, res) => {
  const db = dbManager.getData();
  const expense = db.expenses.find((e) => e.id === req.params.id);
  if (!expense) return res.status(404).json({ error: 'Dépense non trouvée' });

  try {
    await supabaseService.deleteExpense(req.params.id);
    dbManager.deleteExpense(req.params.id);
    dbManager.addAuditLog(
      { id: req.body.userId || 'USR-ADMIN', name: req.body.userName || 'Direction', role: 'admin' },
      'DELETE',
      'EXPENSE',
      expense.id,
      `Suppression pièce de dépense ${expense.voucherNumber} (${expense.originalAmount} ${expense.currency})`
    );
    dbManager.save();
    res.json({ success: true, message: `Dépense ${expense.voucherNumber} supprimée.` });
  } catch (err: any) {
    res.status(500).json({ error: `Erreur suppression Supabase : ${err.message}` });
  }
});

// --- Employees & Payroll (RH / Salaires) ---
router.get('/employees', (req, res) => {
  res.json(dbManager.getData().employees);
});

router.post('/employees', async (req, res) => {
  const db = dbManager.getData();
  const newEmp: Employee = {
    id: `EMP-${Date.now()}`,
    employeeCode: `EMP-${req.body.country === 'Chine' ? 'GZ' : req.body.country === 'Angola' ? 'LAD' : 'KIN'}-${String(db.employees.length + 1).padStart(2, '0')}`,
    fullName: req.body.fullName,
    phone: req.body.phone,
    jobTitle: req.body.jobTitle,
    agencyId: req.body.agencyId,
    agencyName: req.body.agencyName,
    country: req.body.country,
    baseSalaryUSD: Number(req.body.baseSalaryUSD) || 500,
    preferredCurrency: req.body.preferredCurrency || 'USD',
    status: 'actif',
    hireDate: req.body.hireDate || new Date().toISOString().split('T')[0],
  };

  db.employees.push(newEmp);
  dbManager.save();
  await supabaseService.upsertEmployee(newEmp).catch((e) => console.error('[Supabase employee]', e));
  res.json(newEmp);
});

router.put('/employees/:id', async (req, res) => {
  const db = dbManager.getData();
  const index = db.employees.findIndex((e) => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Employé non trouvé' });

  db.employees[index] = {
    ...db.employees[index],
    ...req.body,
  };
  dbManager.save();
  await supabaseService.upsertEmployee(db.employees[index]).catch((e) => console.error('[Supabase employee]', e));
  res.json(db.employees[index]);
});

router.delete('/employees/:id', async (req, res) => {
  const db = dbManager.getData();
  const emp = db.employees.find((e) => e.id === req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employé non trouvé' });

  try {
    await supabaseService.deleteEmployee(req.params.id);
    dbManager.deleteEmployee(req.params.id);
    dbManager.addAuditLog(
      { id: req.body.userId || 'USR-ADMIN', name: req.body.userName || 'Direction', role: 'admin' },
      'DELETE',
      'EMPLOYEE',
      emp.id,
      `Suppression de l'employé ${emp.fullName} (${emp.employeeCode})`
    );
    dbManager.save();
    res.json({ success: true, message: `Employé ${emp.fullName} supprimé.` });
  } catch (err: any) {
    res.status(500).json({ error: `Erreur suppression Supabase : ${err.message}` });
  }
});

router.get('/salaries', (req, res) => {
  res.json(dbManager.getData().salaryPayments);
});

router.post('/salaries', async (req, res) => {
  const db = dbManager.getData();
  const rates = db.exchangeRates;
  const now = new Date();
  const dateStr = req.body.paymentDate || now.toISOString().split('T')[0];

  const baseUSD = Number(req.body.baseSalaryUSD) || 0;
  const primesUSD = Number(req.body.primesUSD) || 0;
  const avancesUSD = Number(req.body.avancesUSD) || 0;
  const retenuesUSD = Number(req.body.retenuesUSD) || 0;
  const overtimeUSD = Number(req.body.overtimeUSD) || 0;

  const netSalaryUSD = baseUSD + primesUSD + overtimeUSD - avancesUSD - retenuesUSD;
  const currency = req.body.currency || 'USD';

  let exchangeRate = Number(req.body.exchangeRate);
  if (!exchangeRate || exchangeRate <= 0) {
    if (currency === 'USD') exchangeRate = 1;
    else if (currency === 'CNY') exchangeRate = rates.CNY;
    else if (currency === 'CDF') exchangeRate = rates.CDF;
    else if (currency === 'AOA') exchangeRate = rates.AOA;
    else exchangeRate = 1;
  }

  const paidAmountOriginal = currency === 'USD' ? netSalaryUSD : Number((netSalaryUSD * exchangeRate).toFixed(2));
  const slipNumber = `PAY-${req.body.periodMonth || '2026-10'}-${String(db.salaryPayments.length + 1).padStart(3, '0')}`;

  const payment: SalaryPayment = {
    id: `SAL-${Date.now()}`,
    slipNumber,
    employeeId: req.body.employeeId,
    employeeName: req.body.employeeName,
    jobTitle: req.body.jobTitle,
    agencyName: req.body.agencyName,
    country: req.body.country,
    periodMonth: req.body.periodMonth || '2026-10',
    baseSalaryUSD: baseUSD,
    primesUSD,
    avancesUSD,
    retenuesUSD,
    overtimeUSD,
    netSalaryUSD,
    paidAmountOriginal,
    currency,
    exchangeRate,
    paymentDate: dateStr,
    status: req.body.status || 'PAYE',
    paymentMethod: req.body.paymentMethod || 'Espèces',
    notes: req.body.notes || '',
  };

  db.salaryPayments.unshift(payment);

  // Auto record as expense if marked PAYE
  if (payment.status === 'PAYE') {
    const voucherNumber = `DEP-SAL-${String(db.expenses.length + 1).padStart(4, '0')}`;
    const exp: Expense = {
      id: `DEP-${Date.now()}`,
      voucherNumber,
      category: 'salaire',
      categoryLabel: 'Salaires & Rémunérations',
      originalAmount: paidAmountOriginal,
      currency,
      exchangeRate,
      amountUSD: netSalaryUSD,
      agencyId: req.body.agencyId || 'AG-GOMBE',
      agencyName: payment.agencyName,
      country: payment.country,
      beneficiary: payment.employeeName,
      date: dateStr,
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      recordedBy: req.body.userName || 'Direction RH',
      description: `Règlement salaire ${payment.periodMonth} [Bulletin ${slipNumber}]`,
    };
    db.expenses.unshift(exp);
    supabaseService.upsertExpense(exp).catch((e) => console.error('[Supabase salary expense]', e));
  }

  dbManager.addAuditLog(
    { id: req.body.userId || 'USR-ADMIN', name: req.body.userName || 'Direction', role: 'admin' },
    'PAYMENT',
    'EMPLOYEE',
    payment.id,
    `Émission bulletin de paie ${slipNumber} pour ${payment.employeeName} (${netSalaryUSD} USD / ${paidAmountOriginal} ${currency})`
  );

  dbManager.save();
  await supabaseService.upsertSalaryPayment(payment).catch((e) => console.error('[Supabase salary]', e));
  res.json(payment);
});

router.delete('/salaries/:id', async (req, res) => {
  const db = dbManager.getData();
  const sal = db.salaryPayments.find((s) => s.id === req.params.id);
  if (!sal) return res.status(404).json({ error: 'Bulletin non trouvé' });

  try {
    await supabaseService.deleteSalaryPayment(req.params.id);
    dbManager.deleteSalaryPayment(req.params.id);
    dbManager.save();
    res.json({ success: true, message: `Bulletin de paie ${sal.slipNumber} supprimé.` });
  } catch (err: any) {
    res.status(500).json({ error: `Erreur suppression Supabase : ${err.message}` });
  }
});

// --- Supabase & PostgreSQL Integration Endpoints ---
router.get('/supabase/status', (_req, res) => {
  res.json(supabaseService.getStatus());
});

router.post('/supabase/config', (req, res) => {
  const { url, key } = req.body;
  if (!url || !key) {
    return res.status(400).json({ error: 'URL et clé requises' });
  }
  const result = supabaseService.updateConfig(url, key);
  res.json(result);
});

router.post('/supabase/test', async (_req, res) => {
  const result = await supabaseService.testConnection();
  res.json(result);
});

router.get('/supabase/schema', (_req, res) => {
  try {
    const schemaPath = path.resolve(__dirname, '../supabase/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sqlContent = fs.readFileSync(schemaPath, 'utf-8');
      return res.json({ sql: sqlContent });
    }
    res.status(404).json({ error: 'Fichier schema.sql introuvable' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/supabase/counts', async (_req, res) => {
  try {
    const counts = await supabaseService.getTableCounts();
    res.json(counts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/supabase/pull', async (_req, res) => {
  try {
    const data = await supabaseService.fetchFromSupabase();
    if (!data) {
      return res.status(500).json({ error: 'Impossible de récupérer les données depuis Supabase' });
    }
    dbManager.applySupabaseData(data);
    const counts = await supabaseService.getTableCounts();
    res.json({
      success: true,
      message: 'Données rechargées avec succès depuis Supabase PostgreSQL',
      counts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/supabase/sync', async (_req, res) => {
  try {
    const result = await supabaseService.syncLocalToSupabase();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
