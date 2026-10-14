import { createClient } from 'npm:@supabase/supabase-js@2';
import { basisForMode, computeParcelPricing, currencyRate, isPricingCurrency, roundMoney, volumeFromDimensionsCm } from '../_shared/parcelPricing.ts';

type Role = 'admin' | 'china_team' | 'kinshasa_team' | 'cashier' | 'client';
type Profile = { id: string; username: string; full_name: string; email: string; phone: string; role: Role; agency_id: string | null; agency_name: string | null; status: string; client_id?: string | null };

// Access-Control-Allow-Origin is added per request in Deno.serve (see allowOrigin).
const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
// APP_ORIGIN may list several comma-separated origins, with "*" wildcards
// (e.g. Firebase preview channels "https://site--*.web.app"); unset means any origin.
const allowedOrigins = (Deno.env.get('APP_ORIGIN') || '').split(',').map((o) => o.trim()).filter(Boolean);
const originPatterns = allowedOrigins.map(
  (o) => new RegExp('^' + o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+') + '$', 'i')
);
function allowOrigin(requestOrigin: string | null) {
  if (allowedOrigins.length === 0) return '*';
  return requestOrigin && originPatterns.some((pattern) => pattern.test(requestOrigin)) ? requestOrigin : allowedOrigins[0];
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
});
// Columns ending in _usd map to the frontend's ...USD keys (total_cost_usd <-> totalCostUSD).
const snakeToCamel = (key: string) => key.replace(/_usd$/, 'USD').replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const camelToSnake = (key: string) => key.replace(/USD$/, '_usd').replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const fromRow = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([key, value]) => [snakeToCamel(key), value]));
const toRow = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([key, value]) => [camelToSnake(key), value]));
const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toISOString().slice(11, 16);
const id = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const allowed: Record<string, Record<string, Role[]>> = {
  users: { GET: ['admin'], POST: ['admin'], PUT: ['admin'], DELETE: ['admin'] },
  agencies: { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier', 'client'], POST: ['admin'] },
  'exchange-rates': { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier', 'client'], PUT: ['admin'] },
  stats: { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier'] },
  'audit-logs': { GET: ['admin'] },
  notifications: { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier', 'client'], POST: ['admin', 'china_team', 'kinshasa_team', 'cashier', 'client'] },
  clients: { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier'], POST: ['admin', 'china_team', 'kinshasa_team', 'cashier'], PUT: ['admin'], DELETE: ['admin'] },
  parcels: { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier', 'client'], POST: ['admin', 'china_team'], PUT: ['admin'], DELETE: ['admin'] },
  shipments: { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier'], POST: ['admin', 'china_team'], PUT: ['admin', 'china_team'], DELETE: ['admin'] },
  payments: { GET: ['admin', 'cashier', 'client'], POST: ['admin', 'cashier'], PUT: ['admin', 'cashier'], DELETE: ['admin'] },
  expenses: { GET: ['admin', 'cashier'], POST: ['admin', 'cashier'], PUT: ['admin', 'cashier'], DELETE: ['admin'] },
  employees: { GET: ['admin'], POST: ['admin'], PUT: ['admin'], DELETE: ['admin'] },
  salaries: { GET: ['admin'], POST: ['admin'], PUT: ['admin'], DELETE: ['admin'] },
  supabase: { GET: ['admin'], POST: ['admin'] },
  uploads: { POST: ['admin', 'china_team'] },
  'payment-methods': { GET: ['admin', 'china_team', 'kinshasa_team', 'cashier'], POST: ['admin'], PUT: ['admin'] },
};
const PHOTO_BUCKET = 'parcel-photos';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PARCEL_PHOTOS = 10;
// Validation failures that should reach the user with a precise message and status.
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const tables = new Set(['payment-methods', 'users', 'agencies', 'clients', 'parcels', 'shipments', 'payments', 'expenses', 'employees', 'salary_payments', 'audit_logs', 'notifications']);

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function audit(actor: Profile, action: string, entityType: string, entityId: string, details: string, oldValue?: unknown, newValue?: unknown) {
  const { error } = await db.from('audit_logs').insert({
    id: id('LOG'), timestamp: new Date().toISOString(), user_id: actor.id, user_name: actor.full_name,
    user_role: actor.role, agency_name: actor.agency_name, action, entity_type: entityType,
    entity_id: entityId, details, old_value: oldValue ?? null, new_value: newValue ?? null,
  });
  if (error) throw error;
}

function auditRow(actor: Profile, action: string, entityType: string, entityId: string, details: string, oldValue?: unknown, newValue?: unknown) {
  return { id: id('LOG'), timestamp: new Date().toISOString(), user_id: actor.id, user_name: actor.full_name, user_role: actor.role, agency_name: actor.agency_name, action, entity_type: entityType, entity_id: entityId, details, old_value: oldValue ?? null, new_value: newValue ?? null };
}

function notificationRow(type: string, title: string, message: string, targetRole = 'ALL', parcelTracking?: string) {
  return { id: id('NOTIF'), timestamp: new Date().toISOString(), type, title, message, target_role: targetRole, parcel_tracking: parcelTracking ?? null, is_read: false };
}

async function notify(type: string, title: string, message: string, targetRole = 'ALL', parcelTracking?: string) {
  const { error } = await db.from('notifications').insert({
    id: id('NOTIF'), timestamp: new Date().toISOString(), type, title, message,
    target_role: targetRole, parcel_tracking: parcelTracking ?? null, is_read: false,
  });
  if (error) throw error;
}

// Reads made for a user go through `scoped` (that user's JWT) so Postgres RLS
// decides which rows they may see; `db` (service_role) is for writes and checks.
function scopedClient(token: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function list(table: string, order = 'created_at', client: any = db): Promise<any[]> {
  const { data, error } = await client.from(table).select('*').order(order, { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

async function nextSequence(counter: string) {
  const { data, error } = await db.rpc('next_app_sequence', { p_counter_name: counter });
  if (error) throw error;
  return Number(data);
}

async function loadRatesRow() {
  const { data, error } = await db.from('exchange_rates').select('*').order('id', { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

// API shape expected by the frontend (ExchangeRates in src/types).
function ratesResponse(row: any) {
  return {
    USD: 1,
    CNY: Number(row?.cny_rate) || 7.25,
    CDF: Number(row?.cdf_rate) || 2850,
    AOA: Number(row?.aoa_rate) || 920,
    lastUpdated: row?.last_updated || today(),
    maritimePricePerKg: Number(row?.maritime_price_per_kg) || 0, // historique (avant le calcul au CBM)
    maritimePricePerCbm: Number(row?.maritime_price_per_cbm) || 0,
    aerienPricePerKg: Number(row?.aerien_price_per_kg) || 0,
    freightRateCurrency: isPricingCurrency(row?.freight_rate_currency) ? row.freight_rate_currency : 'USD',
    // Default transit delay in days (null = not configured by the administrator).
    aerienTransitDays: transitDaysOrNull(row?.aerien_transit_days),
    maritimeTransitDays: transitDaysOrNull(row?.maritime_transit_days),
  };
}

const transitDaysOrNull = (value: unknown): number | null =>
  value === null || value === undefined || value === '' || !Number.isInteger(Number(value)) ? null : Number(value);

/** Validates a transit delay: whole number of days between 0 and 365, or empty (null). */
function parseTransitDays(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 365) throw new ApiError(400, `${label} invalide : saisissez un nombre entier de jours (0 à 365).`);
  return n;
}

/** Day (YYYY-MM-DD) + number of days. */
function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Validates a calendar day (YYYY-MM-DD) that is not in the future (1 day tolerance for time zones). */
function parseDay(value: unknown, label: string): string {
  const day = String(value ?? '');
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
    throw new ApiError(400, `${label} invalide (format attendu : AAAA-MM-JJ).`);
  }
  if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new ApiError(400, `${label} ne peut pas être dans le futur.`);
  return day;
}

/** Amount in USD for a correction: same currency keeps the original rate, a new currency takes today's rate. */
function correctionToUsd(amount: number, currency: string, before: { currency: string; exchange_rate: unknown }, rates: ReturnType<typeof ratesResponse>) {
  if (!isPricingCurrency(currency)) throw new ApiError(400, 'Devise non prise en charge (USD, CNY, CDF ou AOA).');
  const exchangeRate = currency === 'USD' ? 1 : currency === before.currency ? Number(before.exchange_rate) || currencyRate(currency, rates) : currencyRate(currency, rates);
  if (!(exchangeRate > 0)) throw new ApiError(400, `Taux de change ${currency} indisponible.`);
  return { exchangeRate, amountUSD: currency === 'USD' ? roundMoney(amount) : roundMoney(amount / exchangeRate) };
}

const pick = (row: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map((k) => [snakeToCamel(k), row[k] ?? null]));

function correctionError(error: { message?: string }, fallbackLabel: string): never {
  const message = String(error?.message || '');
  if (message.includes('INVALID_AMOUNT')) throw new ApiError(400, 'Le montant doit être supérieur à 0.');
  if (message.includes('SALARY_EXPENSE')) throw new ApiError(400, 'Cette dépense provient d’un bulletin de salaire : modifiez ou supprimez le bulletin dans « Salaires ».');
  if (message.includes('non trouv')) throw new ApiError(404, `${fallbackLabel} introuvable.`);
  throw error;
}

// --- Cash boxes: every receipt/expense belongs to a real agency and a payment
// method configured for that agency's country (table payment_methods).
async function assertPaymentMethod(country: string, code: unknown): Promise<string> {
  const value = String(code ?? '').trim();
  if (!value) throw new ApiError(400, 'Choisissez le moyen de paiement.');
  const { data, error } = await db.from('payment_methods').select('code').eq('country', country).eq('code', value).eq('active', true).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(400, `Moyen de paiement « ${value} » non disponible pour la caisse ${country}.`);
  return value;
}

/** Agency whose cash box receives the money: the cashier's own agency; the admin may choose one. */
async function resolveCashAgency(actor: Profile, requestedAgencyId: unknown) {
  const wanted = actor.role === 'admin' && requestedAgencyId ? String(requestedAgencyId) : actor.agency_id;
  const agency = await loadAgency(wanted || null, 'Agence');
  if (!agency) throw new ApiError(400, 'Aucune agence n’est rattachée à cette opération : impossible de l’affecter à une caisse. Choisissez une agence.');
  return agency;
}

/** Salary slips store a free-text method; map it to the cash box method code. */
function salaryMethodCode(text: unknown): string | null {
  const value = String(text || '').toLowerCase();
  if (/esp[eè]ce|cash/.test(value)) return 'ESPECES';
  if (/vir|banq|bank/.test(value)) return 'BANQUE';
  if (/m-?pesa/.test(value)) return 'MPESA';
  if (/orange/.test(value)) return 'ORANGE_MONEY';
  if (/airtel/.test(value)) return 'AIRTEL_MONEY';
  if (/afri/.test(value)) return 'AFRIMONEY';
  if (/alipay/.test(value)) return 'ALIPAY';
  return null;
}

async function loadAgency(agencyId: string | null, label: string): Promise<{ id: string; name: string; country: string; type: string } | null> {
  if (!agencyId) return null;
  const { data, error } = await db.from('agencies').select('id,name,country,type').eq('id', agencyId).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(400, `${label} introuvable (${agencyId}). Sélectionnez une agence existante.`);
  return data;
}

// Staff accounts: role is mandatory; operational roles must be attached to a
// matching agency (China team -> China agency, Kinshasa team -> RDC/Angola agency).
async function resolveStaffAgency(role: unknown, agencyId: unknown) {
  if (!['admin', 'china_team', 'kinshasa_team', 'cashier', 'client'].includes(String(role))) throw new ApiError(400, 'Rôle utilisateur invalide.');
  if (role === 'client') throw new ApiError(400, 'Les comptes clients sont créés par les clients eux-mêmes (« Créer mon compte client ») puis associés à leur fiche.');
  const agency = await loadAgency(agencyId ? String(agencyId) : null, 'Agence');
  if (role === 'admin') return agency;
  if (!agency) throw new ApiError(400, 'Une agence est obligatoire pour ce rôle.');
  if (role === 'china_team' && agency.country !== 'Chine') throw new ApiError(400, 'L’équipe Chine doit être rattachée à une agence située en Chine.');
  if (role === 'kinshasa_team' && !['RDC', 'Angola'].includes(agency.country)) throw new ApiError(400, 'L’équipe de destination doit être rattachée à une agence en RDC ou en Angola.');
  return agency;
}

async function assertExists(table: string, recordId: string | null, label: string) {
  if (!recordId) return;
  const { data, error } = await db.from(table).select('id').eq('id', recordId).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(400, `${label} introuvable (${recordId}). Sélectionnez une valeur existante.`);
}

// Turn PostgREST/Postgres errors into messages an operator can act on.
function describeDbError(error: unknown): string {
  const e = (error ?? {}) as { message?: string; code?: string; details?: string };
  if (e.code === '23503') return `Référence invalide (agence, client ou expédition inexistant). ${e.details || ''}`.trim();
  if (e.code === '23505') return `Doublon refusé par la base : ${e.details || e.message || ''}`.trim();
  if (e.code === '23514') return 'Valeur refusée par la base : les montants et le poids doivent être positifs.';
  if (e.code === '23502') return `Champ obligatoire manquant : ${e.message || ''}`.trim();
  if (e.code === '42703' || e.code === 'PGRST204') return `Colonne absente dans Supabase (${e.message || ''}). Appliquez la migration 202610110002_parcel_freight_pricing.sql.`;
  return e.message || 'Erreur serveur';
}

function ratesToUsd(currency: string, amount: number, rates: Record<string, number>) {
  const rate = currency === 'USD' ? 1 : Number(rates[currency]) || 1;
  return { exchangeRate: rate, amountUSD: currency === 'USD' ? amount : Number((amount / rate).toFixed(2)) };
}

async function refreshClient(clientId?: string | null) {
  if (!clientId) return;
  const [{ data: parcels, error: parcelError }, { data: payments, error: paymentError }] = await Promise.all([
    db.from('parcels').select('total_cost_usd').eq('client_id', clientId),
    db.from('payments').select('amount_usd').eq('client_id', clientId),
  ]);
  if (parcelError) throw parcelError;
  if (paymentError) throw paymentError;
  const total = ((parcels || []) as Array<{ total_cost_usd: number | string | null }>).reduce((sum: number, row) => sum + Number(row.total_cost_usd || 0), 0);
  const paid = ((payments || []) as Array<{ amount_usd: number | string | null }>).reduce((sum: number, row) => sum + Number(row.amount_usd || 0), 0);
  const { error } = await db.from('clients').update({ total_parcels: (parcels || []).length, total_amount_usd: total, total_paid_usd: paid, remaining_balance_usd: Math.max(0, total - paid) }).eq('id', clientId);
  if (error) throw error;
}

async function recalculateParcel(parcelId: string) {
  const { data: parcel, error } = await db.from('parcels').select('client_id,total_cost_usd').eq('id', parcelId).maybeSingle();
  if (error) throw error;
  if (!parcel) return;
  const { data: payments, error: paymentError } = await db.from('payments').select('amount_usd').eq('parcel_id', parcelId);
  if (paymentError) throw paymentError;
  const paid = ((payments || []) as Array<{ amount_usd: number | string | null }>).reduce((sum: number, row) => sum + Number(row.amount_usd || 0), 0);
  const { error: updateError } = await db.from('parcels').update({ amount_paid_usd: paid, remaining_amount_usd: Math.max(0, Number(parcel.total_cost_usd || 0) - paid) }).eq('id', parcelId);
  if (updateError) throw updateError;
  await refreshClient(parcel.client_id);
}

// Statistics are computed from the rows RLS lets this user read: each role and
// agency sees only its own figures; only the admin gets company-wide totals.
async function calculateStats(client: any, actor: Profile) {
  const [parcels, shipments, payments, expenses, allClients, salaries] = await Promise.all([
    list('parcels', 'created_at', client), list('shipments', 'created_at', client), list('payments', 'created_at', client),
    list('expenses', 'created_at', client), list('clients', 'created_at', client), list('salary_payments', 'payment_date', client),
  ]);
  // Outside the admin, client counters are limited to clients of the visible parcels/payments.
  const scopedClientIds = new Set([...parcels.map((p) => p.clientId), ...payments.map((p) => p.clientId)].filter(Boolean));
  const clients = actor.role === 'admin' ? allClients : allClients.filter((c) => scopedClientIds.has(c.id));
  const clientPaid = actor.role === 'admin' ? null : payments.reduce((t, p) => t + Number(p.amountUSD || 0), 0);
  const clientRemaining = actor.role === 'admin' ? null : parcels.reduce((t, p) => t + Number(p.remainingAmountUSD || 0), 0);
  const count = (items: any[], statuses: string[]) => items.filter((item) => statuses.includes(item.status)).length;
  const sum = (items: any[], key: string) => items.reduce((total, item) => total + Number(item[key] || 0), 0);
  const byCurrency = (currency: string) => sum(payments.filter((p) => p.currency === currency), 'originalAmount') - sum(expenses.filter((e) => e.currency === currency), 'originalAmount');
  const revenue = sum(payments, 'amountUSD');
  const spend = sum(expenses, 'amountUSD');
  return {
    parcels: { total: parcels.length, inChina: count(parcels, ['COMMANDE_CREEE', 'ATTENTE_RECEPTION_CHINE', 'RECU_CHINE', 'IDENTIFIE', 'CONTROLE', 'PREPARE_EXPEDITION', 'EXPEDITION_EN_PREPARATION']), inTransit: count(parcels, ['EXPEDIE', 'EN_TRANSIT']), arrived: count(parcels, ['ARRIVE_DESTINATION', 'DEDOUANEMENT_TRAITEMENT']), availableAtAgency: count(parcels, ['DISPONIBLE_AGENCE', 'PREPARATION_LIVRAISON', 'EN_COURS_LIVRAISON']), delivered: count(parcels, ['LIVRE', 'RETIRE_CLIENT']), anomalies: count(parcels, ['ANOMALIE']) },
    shipments: { total: shipments.length, maritime: shipments.filter((s) => s.transportMode === 'MARITIME').length, aerien: shipments.filter((s) => s.transportMode === 'AERIEN').length, inProgress: count(shipments, ['EN_PREPARATION', 'EXPEDIE', 'EN_TRANSIT']), arrived: count(shipments, ['ARRIVE', 'TRAITE']) },
    finances: { totalRevenueUSD: revenue, totalExpensesUSD: spend, netBalanceUSD: revenue - spend, clientTotalPaidUSD: clientPaid ?? sum(clients, 'totalPaidUSD'), clientTotalRemainingUSD: clientRemaining ?? sum(clients, 'remainingBalanceUSD'), totalSalariesPaidUSD: sum(salaries, 'netSalaryUSD'), chinaExpensesUSD: sum(expenses.filter((e) => e.country === 'Chine'), 'amountUSD'), kinshasaExpensesUSD: sum(expenses.filter((e) => e.country === 'RDC'), 'amountUSD'), angolaExpensesUSD: sum(expenses.filter((e) => e.country === 'Angola'), 'amountUSD'), balancesByCurrency: { USD: byCurrency('USD'), CNY: byCurrency('CNY'), CDF: byCurrency('CDF'), AOA: byCurrency('AOA') } },
    clients: actor.role === 'admin'
      ? { total: clients.length, active: clients.filter((c) => Number(c.totalParcels) > 0).length, withPendingBalance: clients.filter((c) => Number(c.remainingBalanceUSD) > 0).length }
      : { total: clients.length, active: clients.length, withPendingBalance: new Set(parcels.filter((p) => Number(p.remainingAmountUSD) > 0).map((p) => p.clientId).filter(Boolean)).size },
  };
}

const phoneDigits = (phone: unknown) => String(phone || '').replace(/\D/g, '');
// Same subscriber number with or without country code (+243 82… vs 082…).
function samePhone(a: unknown, b: unknown) {
  const x = phoneDigits(a), y = phoneDigits(b);
  return x.length >= 9 && y.length >= 9 && x.slice(-9) === y.slice(-9);
}

function ownsParcel(actor: Profile, row: { client_id?: string | null; sender_client_id?: string | null }) {
  return !!actor.client_id && (row.client_id === actor.client_id || row.sender_client_id === actor.client_id);
}

async function clientTrackingNumbers(actor: Profile): Promise<string[]> {
  if (!actor.client_id) return [];
  const { data, error } = await db.from('parcels').select('tracking_number')
    .or(`client_id.eq.${actor.client_id},sender_client_id.eq.${actor.client_id}`);
  if (error) throw error;
  return ((data || []) as Array<{ tracking_number: string }>).map((row) => row.tracking_number);
}

// --- Client self-service accounts -------------------------------------------
const ACTIVATION_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVATION_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

function generateActivationCode() {
  const chars: string[] = [];
  while (chars.length < 8) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      // Rejection sampling keeps every character equally likely.
      if (byte < 248 && chars.length < 8) chars.push(ACTIVATION_ALPHABET[byte % 31]);
    }
  }
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}
const normalizeActivationCode = (code: unknown) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Links a verified Supabase Auth account to the client file created by an agent.
// Proof required: verified e-mail + phone on file, and either the e-mail on file
// or a one-time activation code issued by an agent. Name/phone alone never suffice.
async function linkClientAccount(request: Request, body: any): Promise<Response> {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: 'Session Supabase requise.' }, 401);
  const { data: auth, error: authError } = await authClient.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Session Supabase invalide ou expirée.' }, 401);
  const authUser = auth.user;
  if (!authUser.email || !authUser.email_confirmed_at) {
    throw new ApiError(403, 'Confirmez d’abord votre adresse e-mail avec le lien reçu, puis reconnectez-vous.');
  }

  const { data: withinLimit, error: limitError } = await db.rpc('check_public_track_rate_limit', { p_request_key: `client-link:${authUser.id}`, p_limit: 5 });
  if (limitError) throw limitError;
  if (!withinLimit) throw new ApiError(429, 'Trop de tentatives. Patientez une minute avant de réessayer.');

  const { data: existing, error: existingError } = await db.from('users').select('*').eq('auth_user_id', authUser.id).maybeSingle();
  if (existingError) throw existingError;
  if (existing) throw new ApiError(409, 'Ce compte est déjà associé à un profil. Reconnectez-vous.');

  const noMatch = 'Aucune fiche client ne correspond à ces informations. Demandez un code d’activation à votre agence GZ Mubua Global.';
  if (phoneDigits(body.phone).length < 9) throw new ApiError(400, 'Saisissez le numéro de téléphone communiqué à votre agence.');

  let clientId: string;
  let codeId: string | null = null;
  const code = normalizeActivationCode(body.activationCode);
  if (code) {
    const { data: codeRow, error: codeError } = await db.from('client_activation_codes')
      .select('id,client_id,expires_at,used_at').eq('code_hash', await sha256Hex(code)).maybeSingle();
    if (codeError) throw codeError;
    if (!codeRow || codeRow.used_at || new Date(codeRow.expires_at).getTime() <= Date.now()) {
      throw new ApiError(400, 'Code d’activation invalide ou expiré. Demandez un nouveau code à votre agence.');
    }
    clientId = codeRow.client_id;
    codeId = codeRow.id;
  } else {
    const { data: withEmail, error: emailError } = await db.from('clients').select('id,email').not('email', 'is', null);
    if (emailError) throw emailError;
    const target = authUser.email.trim().toLowerCase();
    const matches = ((withEmail || []) as Array<{ id: string; email: string }>).filter((c) => String(c.email || '').trim().toLowerCase() === target);
    if (matches.length !== 1) throw new ApiError(404, noMatch);
    clientId = matches[0].id;
  }

  const { data: client, error: clientError } = await db.from('clients').select('id,full_name,phone,code').eq('id', clientId).maybeSingle();
  if (clientError) throw clientError;
  if (!client || !samePhone(client.phone, body.phone)) {
    throw new ApiError(400, code ? 'Ce numéro de téléphone ne correspond pas à la fiche client liée à ce code.' : noMatch);
  }

  const userId = id('USR');
  const actorForAudit = { id: userId, full_name: client.full_name, role: 'client', agency_name: null } as unknown as Profile;
  const { data: profile, error: linkError } = await db.rpc('link_client_account_transaction', {
    p_auth_user_id: authUser.id,
    p_email: authUser.email,
    p_client_id: client.id,
    p_code_id: codeId,
    p_user_id: userId,
    audit_data: auditRow(actorForAudit, 'CREATE', 'USER', userId,
      `Compte client créé et associé à la fiche ${client.code} (${client.full_name}) — vérification : e-mail confirmé + téléphone + ${codeId ? 'code d’activation' : 'e-mail enregistré par l’agence'}`),
  });
  if (linkError) {
    const message = String(linkError.message || '');
    if (message.includes('CLIENT_ALREADY_LINKED')) throw new ApiError(409, 'Cette fiche client est déjà associée à un autre compte. Contactez votre agence.');
    if (message.includes('AUTH_ALREADY_LINKED')) throw new ApiError(409, 'Ce compte est déjà associé à un profil. Reconnectez-vous.');
    if (message.includes('CODE_INVALID')) throw new ApiError(400, 'Code d’activation invalide ou expiré. Demandez un nouveau code à votre agence.');
    throw linkError;
  }
  const { auth_user_id: _authUserId, ...safe } = profile as Record<string, unknown>;
  return json({ profile: fromRow(safe) }, 201);
}

async function findOrCreateClient(fullName: string, phone: string, destination: unknown, actor: Profile): Promise<string> {
  const digits = phoneDigits(phone);
  const { data: candidates, error } = await db.from('clients').select('id,phone');
  if (error) throw error;
  const existing = ((candidates || []) as Array<{ id: string; phone: string }>).find((c) => digits && samePhone(c.phone, phone));
  if (existing) return existing.id;
  const seq = await nextSequence('client');
  const angola = destination === 'Angola';
  const client = { id: id('CLI'), code: `CLI-${String(seq).padStart(3, '0')}`, full_name: fullName, phone, email: '', address: '', city: angola ? 'Luanda' : 'Kinshasa', country: angola ? 'Angola' : 'RDC', total_parcels: 0, total_amount_usd: 0, total_paid_usd: 0, remaining_balance_usd: 0, created_at: today(), notes: 'Créé automatiquement à l’enregistrement d’un colis' };
  const { error: insertError } = await db.from('clients').insert(client);
  if (insertError) throw insertError;
  await audit(actor, 'CREATE', 'CLIENT', client.id, `Création du client ${client.full_name} (enregistrement colis)`);
  return client.id;
}

async function createParcel(body: any, actor: Profile) {
  const clientName = String(body.clientName || '').trim();
  const clientPhone = String(body.clientPhone || '').trim();
  const description = String(body.description || '').trim();
  if (!clientName || !clientPhone || !description) throw new ApiError(400, 'Nom du client, téléphone et description sont obligatoires.');

  // Price on the server from the universal tariff; the browser's amounts are never trusted.
  const rates = ratesResponse(await loadRatesRow());
  const transportMode = body.transportMode === 'AERIEN' ? 'AERIEN' : 'MARITIME';
  const currency = rates.freightRateCurrency;
  // Air is billed by weight (price per kg), sea by volume (price per CBM).
  const basis = basisForMode(transportMode);
  const unitPrice = basis === 'KG' ? rates.aerienPricePerKg : rates.maritimePricePerCbm;
  const appliedUnitPrice = body.appliedUnitPrice ?? body.appliedPricePerKg;
  if (body.pricingCurrency !== undefined && (body.pricingCurrency !== currency || Number(appliedUnitPrice || 0) !== unitPrice)) {
    throw new ApiError(409, 'Le tarif a été modifié entre-temps. Fermez puis rouvrez le formulaire pour appliquer le tarif actuel.');
  }
  // Volume always comes from the dimensions (cm) when they are given.
  const volumeCbm = volumeFromDimensionsCm(body.lengthCm, body.widthCm, body.heightCm) ?? (Number(body.volumeCbm) > 0 ? Number(body.volumeCbm) : 0);
  const weightKg = basis === 'KG' ? Number(body.weightKg) : Number(body.weightKg) > 0 ? Number(body.weightKg) : 0;
  const pricing = computeParcelPricing({
    basis,
    weightKg,
    volumeCbm,
    unitPrice,
    manualFreightAmount: Number(body.transportCost ?? 0),
    extraFees: Number(body.extraFees ?? 0),
    amountPaid: Number(body.amountPaid ?? 0),
    currency,
    exchangeRate: currencyRate(currency, rates),
  });
  if (!pricing.ok) throw new ApiError(400, pricing.error);
  const price = pricing.value;

  await assertExists('clients', body.clientId || null, 'Client');
  // "+ Nouveau client": reuse the client with the same phone, otherwise create the record.
  if (!body.clientId) body.clientId = await findOrCreateClient(clientName, clientPhone, body.destination, actor);
  // The China team always registers parcels for its own agency; agency names are
  // taken from Supabase, never from the browser.
  const chinaAgencyId = actor.role === 'china_team' ? actor.agency_id : body.chinaAgencyId || null;
  if (actor.role === 'china_team' && !chinaAgencyId) throw new ApiError(403, 'Aucune agence Chine ne vous est attribuée. Contactez l’administrateur.');
  const chinaAgency = await loadAgency(chinaAgencyId, 'Agence Chine');
  const destinationAgency = await loadAgency(body.destinationAgencyId || null, 'Agence de destination');
  await assertExists('shipments', body.shipmentId || null, 'Expédition');
  // Optional: the parcel's sender is also a registered client (visible in their portal).
  let senderClientName: string | null = null;
  if (body.senderClientId) {
    const { data: sender, error: senderError } = await db.from('clients').select('full_name').eq('id', body.senderClientId).maybeSingle();
    if (senderError) throw senderError;
    if (!sender) throw new ApiError(400, `Client expéditeur introuvable (${body.senderClientId}).`);
    senderClientName = sender.full_name;
  }

  const now = today();
  // Reception date chosen in the form: a real calendar day, not in the future
  // (one day of tolerance for time zones ahead of UTC, e.g. Kinshasa / Guangzhou).
  const receptionDate = body.chinaReceptionDate ? String(body.chinaReceptionDate) : now;
  const parsedReception = /^\d{4}-\d{2}-\d{2}$/.test(receptionDate) ? new Date(`${receptionDate}T00:00:00Z`) : null;
  if (!parsedReception || Number.isNaN(parsedReception.getTime()) || parsedReception.toISOString().slice(0, 10) !== receptionDate) {
    throw new ApiError(400, 'Date de réception invalide (format attendu : AAAA-MM-JJ).');
  }
  if (parsedReception.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new ApiError(400, 'La date de réception ne peut pas être dans le futur.');
  // Transit delay: value typed in the form, otherwise the default delay of the transport mode.
  const transitDays = body.estimatedTransitDays !== undefined && body.estimatedTransitDays !== null && body.estimatedTransitDays !== ''
    ? parseTransitDays(body.estimatedTransitDays, 'Délai d’acheminement')
    : transportMode === 'AERIEN' ? rates.aerienTransitDays : rates.maritimeTransitDays;

  // The down payment goes to the cash box of the China agency (else the agent's agency).
  let cashAgency: Awaited<ReturnType<typeof loadAgency>> = null;
  let downPaymentMethod = 'ESPECES';
  if (price.amountPaid > 0) {
    cashAgency = chinaAgency ?? (await loadAgency(actor.agency_id, 'Agence'));
    if (!cashAgency) throw new ApiError(400, 'Aucune agence n’est rattachée à cet acompte : choisissez l’agence Chine du colis.');
    downPaymentMethod = await assertPaymentMethod(cashAgency.country, body.paymentMethod || 'ESPECES');
  }
  const seq = await nextSequence('parcel');
  const receiptSeq = price.amountPaid > 0 ? await nextSequence('payment') : 0;
  const weight = weightKg;
  const l = Number(body.lengthCm) > 0 ? Number(body.lengthCm) : 0, w = Number(body.widthCm) > 0 ? Number(body.widthCm) : 0, h = Number(body.heightCm) > 0 ? Number(body.heightCm) : 0;
  const volume = volumeCbm; // 0 = volume non renseigné (aérien), jamais inventé
  const parcelId = id('PAR'), tracking = `COL-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
  const status = body.status || 'COMMANDE_CREEE';
  const parcel = {
    id: parcelId, tracking_number: tracking, client_id: body.clientId || null, client_name: clientName,
    client_phone: clientPhone, description, quantity: Number(body.quantity) || 1,
    weight_kg: weight, length_cm: l || null, width_cm: w || null, height_cm: h || null, volume_cbm: volume,
    photos: Array.isArray(body.photos)
      ? body.photos.filter((url: unknown) => typeof url === 'string' && url.startsWith('https://')).slice(0, MAX_PARCEL_PHOTOS)
      : [],
    supplier: body.supplier || '', purchase_info: body.purchaseInfo || '',
    china_reception_address: body.chinaReceptionAddress || '', china_reception_date: receptionDate,
    china_agency_id: chinaAgency?.id ?? null, china_agency_name: chinaAgency?.name ?? '',
    shipment_id: body.shipmentId || null, shipment_number: body.shipmentNumber || null,
    sender_client_id: body.senderClientId || null, sender_client_name: senderClientName,
    transport_mode: transportMode, origin: body.origin || '',
    destination: destinationAgency ? (destinationAgency.country === 'Angola' ? 'Angola' : 'Kinshasa') : body.destination || '',
    destination_agency_id: destinationAgency?.id ?? null, destination_agency_name: destinationAgency?.name ?? '',
    status, status_history: [{ id: id('SH'), status, date: now, time: nowTime(), user: actor.full_name, agency: actor.agency_name, comment: body.comment || 'Création du colis' }],
    pricing_currency: price.currency, pricing_unit: price.basis, pricing_exchange_rate: price.exchangeRate,
    price_per_kg: price.basis === 'KG' ? price.unitPrice : null, price_per_cbm: price.basis === 'CBM' ? price.unitPrice : null,
    freight_amount: price.freightAmount, total_amount: price.totalAmount,
    transport_cost_usd: price.transportCostUSD, extra_fees_usd: price.extraFeesUSD,
    total_cost_usd: price.totalCostUSD, amount_paid_usd: 0, remaining_amount_usd: price.totalCostUSD,
    warehouse_location: body.warehouseLocation || '', comments: body.comments || '', created_at: now, updated_at: now,
    estimated_transit_days: transitDays,
    estimated_arrival_date: transitDays !== null ? addDays(receptionDate, transitDays) : null,
  };
  let payment: Record<string, unknown> | null = null;
  if (price.amountPaid > 0) {
    payment = { id: id('PAY'), receipt_number: `REC-${new Date().getFullYear()}-${String(receiptSeq).padStart(4, '0')}`, parcel_id: parcelId, parcel_tracking_number: tracking, client_id: parcel.client_id, client_name: parcel.client_name, type: 'AVANCE', original_amount: price.amountPaid, currency: price.currency, exchange_rate: price.exchangeRate, amount_usd: price.amountPaidUSD, payment_method: downPaymentMethod, date: now, time: nowTime(), agency_id: cashAgency?.id ?? null, agency_name: cashAgency?.name ?? '', cashier_id: actor.id, cashier_name: actor.full_name, notes: `Acompte initial du colis ${tracking}` };
  }
  const { data, error } = await db.rpc('create_parcel_transaction', {
    parcel_data: parcel,
    payment_data: payment,
    audit_data: auditRow(actor, 'CREATE', 'PARCEL', parcelId, `Création du colis ${tracking}`),
    notification_data: notificationRow('PARCEL_CREATED', `Nouveau colis ${tracking}`, `Colis enregistré pour ${parcel.client_name}.`, 'ALL', tracking),
  });
  if (error) throw error;
  return fromRow(data);
}

async function createPayment(body: any, actor: Profile, scoped: any) {
  if (actor.role === 'cashier' && !actor.agency_id) throw new ApiError(403, 'Aucune agence ne vous est attribuée. Contactez l’administrateur.');
  if (!(Number(body.originalAmount) > 0)) throw new ApiError(400, 'Le montant encaissé doit être supérieur à 0.');
  // A receipt is attached to a parcel the cashier can see (RLS: own agency); client comes from the parcel.
  let parcelRow: { id: string; tracking_number: string; client_id: string | null; client_name: string } | null = null;
  if (body.parcelId) {
    const { data, error } = await scoped.from('parcels').select('id,tracking_number,client_id,client_name').eq('id', body.parcelId).maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, 'Colis introuvable ou hors de votre agence.');
    parcelRow = data;
  }
  const cashAgency = await resolveCashAgency(actor, body.agencyId);
  const paymentMethod = await assertPaymentMethod(cashAgency.country, body.paymentMethod);
  const seq = await nextSequence('payment');
  const { data: ratesRow, error: ratesError } = await db.from('exchange_rates').select('*').limit(1).maybeSingle();
  if (ratesError) throw ratesError;
  const currency = body.currency || 'USD', amount = Number(body.originalAmount) || 0;
  const rates = { CNY: Number(ratesRow?.cny_rate) || 7.25, CDF: Number(ratesRow?.cdf_rate) || 2850, AOA: Number(ratesRow?.aoa_rate) || 920 };
  const { exchangeRate, amountUSD } = ratesToUsd(currency, amount, rates);
  const payment = { id: id('PAY'), receipt_number: `REC-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`, parcel_id: parcelRow?.id ?? null, parcel_tracking_number: parcelRow?.tracking_number ?? null, client_id: parcelRow ? parcelRow.client_id : body.clientId || null, client_name: parcelRow?.client_name ?? body.clientName, type: body.type || 'AVANCE', original_amount: amount, currency, exchange_rate: exchangeRate, amount_usd: amountUSD, payment_method: paymentMethod, reference: body.reference || '', date: body.date || today(), time: nowTime(), agency_id: cashAgency.id, agency_name: cashAgency.name, cashier_id: actor.id, cashier_name: actor.full_name, notes: body.notes || '' };
  const { data, error } = await db.rpc('record_payment_transaction', {
    payment_data: payment,
    audit_data: auditRow(actor, 'PAYMENT', 'PAYMENT', payment.id, `Encaissement ${payment.receipt_number} de ${amount} ${currency}`),
    notification_data: notificationRow('PAYMENT_RECEIVED', `Paiement reçu : ${amount} ${currency}`, `Règlement ${payment.receipt_number} enregistré.`, 'cashier'),
  });
  if (error) throw error;
  return fromRow(data);
}

async function createExpense(body: any, actor: Profile) {
  if (!(Number(body.originalAmount) > 0)) throw new ApiError(400, 'Le montant de la dépense doit être supérieur à 0.');
  const cashAgency = await resolveCashAgency(actor, body.agencyId);
  const paymentMethod = await assertPaymentMethod(cashAgency.country, body.paymentMethod);
  const seq = await nextSequence('expense');
  const { data: ratesRow, error: ratesError } = await db.from('exchange_rates').select('*').limit(1).maybeSingle();
  if (ratesError) throw ratesError;
  const currency = body.currency || 'USD', amount = Number(body.originalAmount) || 0;
  const rates = { CNY: Number(ratesRow?.cny_rate) || 7.25, CDF: Number(ratesRow?.cdf_rate) || 2850, AOA: Number(ratesRow?.aoa_rate) || 920 };
  const { exchangeRate, amountUSD } = ratesToUsd(currency, amount, rates);
  const expense = { id: id('DEP'), voucher_number: `DEP-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`, category: body.category || 'autres', category_label: body.categoryLabel || body.category || 'Autres', original_amount: amount, currency, exchange_rate: exchangeRate, amount_usd: amountUSD, agency_id: cashAgency.id, agency_name: cashAgency.name, country: cashAgency.country, payment_method: paymentMethod, beneficiary: body.beneficiary || '', date: body.date || today(), time: nowTime(), recorded_by: actor.full_name, description: body.description || '', attachment_name: body.attachmentName || null, attachment_url: body.attachmentUrl || null };
  const { data, error } = await db.rpc('create_expense_transaction', {
    expense_data: expense,
    audit_data: auditRow(actor, 'EXPENSE', 'EXPENSE', expense.id, `Dépense ${expense.voucher_number} : ${amount} ${currency}`),
  });
  if (error) throw error;
  return fromRow(data);
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/functions\/v1\/api/, '').replace(/^\/api/, '') || '/';
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const method = request.method.toUpperCase();
  const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await request.json().catch(() => ({})) : {};

  let actor: Profile | null = null;
  let scoped: any = db; // replaced by the caller's RLS-scoped client once authenticated
  const isPublicTrack = method === 'GET' && parts[0] === 'track' && parts.length === 2;
  if (isPublicTrack) {
    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { data: withinLimit, error: limitError } = await db.rpc('check_public_track_rate_limit', { p_request_key: clientIp, p_limit: 30 });
    if (limitError) {
      console.error('[Public tracking rate limit]', limitError);
      return json({ error: 'Le suivi public est temporairement indisponible.' }, 503);
    }
    if (!withinLimit) return json({ error: 'Trop de recherches. Réessayez dans une minute.' }, 429);
  }
  // A freshly signed-up client has a verified Auth account but no profile yet.
  if (method === 'POST' && parts[0] === 'client-accounts' && parts[1] === 'link') {
    try {
      return await linkClientAccount(request, body as any);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      console.error('[Edge API client link]', error);
      return json({ error: describeDbError(error) }, 500);
    }
  }
  if (!isPublicTrack) {
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ error: 'Session Supabase requise.' }, 401);
    const { data: auth, error: authError } = await authClient.auth.getUser(token);
    if (authError || !auth.user) return json({ error: 'Session Supabase invalide ou expirée.' }, 401);
    const { data: profile, error: profileError } = await db.from('users').select('*').eq('auth_user_id', auth.user.id).eq('status', 'active').maybeSingle();
    if (profileError || !profile) return json({ error: 'Aucun profil actif associé à cette session.' }, 403);
    actor = profile as Profile;
    scoped = scopedClient(token);
    const operation = parts[0] || '';
    let roles = allowed[operation]?.[method];
    if (operation === 'parcels' && parts[2] === 'status' && method === 'POST') roles = ['admin', 'china_team', 'kinshasa_team'];
    if (operation === 'shipments' && parts[2] === 'depart' && method === 'POST') roles = ['admin', 'china_team'];
    if (operation === 'shipments' && parts[2] === 'arrive' && method === 'POST') roles = ['admin', 'kinshasa_team'];
    if (operation === 'shipments' && parts[2] === 'parcels' && method === 'POST') roles = ['admin', 'china_team'];
    if (!roles?.includes(actor.role)) return json({ error: 'Votre rôle ne permet pas cette opération.' }, 403);
  }

  try {
    const route = parts[0];
    const table = route === 'salaries' ? 'salary_payments' : route === 'audit-logs' ? 'audit_logs' : route;
    const resourceId = parts[1];
    // A client account only reaches records of the client file it was linked to
    // (as recipient or sender), never by phone or name matching.
    if (actor?.role === 'client' && table === 'parcels' && resourceId) {
      const { data: ownedParcel, error } = await db.from('parcels').select('client_id,sender_client_id').eq('id', resourceId).maybeSingle();
      if (error) throw error;
      if (!ownedParcel || !ownsParcel(actor, ownedParcel)) return json({ error: 'Colis non trouvé.' }, 404);
    }
    if (actor?.role === 'client' && table === 'payments' && resourceId) {
      const { data: ownedPayment, error } = await db.from('payments').select('client_id').eq('id', resourceId).maybeSingle();
      if (error) throw error;
      if (!ownedPayment || !actor.client_id || ownedPayment.client_id !== actor.client_id) return json({ error: 'Paiement non trouvé.' }, 404);
    }
    // Any read or change of a specific agency-scoped record requires that RLS lets
    // this user see it: staff cannot act on another agency's parcels, shipments, payments.
    if (actor && actor.role !== 'admin' && resourceId && ['parcels', 'shipments', 'payments', 'expenses'].includes(table)) {
      const { data: visible, error } = await scoped.from(table).select('id').eq('id', resourceId).maybeSingle();
      if (error) throw error;
      if (!visible) return json({ error: 'Enregistrement introuvable ou hors de votre agence.' }, 404);
    }
    if (isPublicTrack) {
      const { data, error } = await db.from('parcels').select('tracking_number,transport_mode,destination,destination_agency_name,status,status_history,estimated_arrival_date').eq('tracking_number', parts[1].toUpperCase()).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Aucun colis trouvé avec ce numéro de suivi.' }, 404);
      return json({ trackingNumber: data.tracking_number, transportMode: data.transport_mode, destination: data.destination, destinationAgencyName: data.destination_agency_name, status: data.status, estimatedArrivalDate: data.estimated_arrival_date ?? null, statusHistory: (data.status_history || []).map(({ status, date, time }: any) => ({ status, date, time })) });
    }

    if (table === 'auth') return json({ error: 'Utilisez Supabase Auth.' }, 404);
    if (table === 'supabase') {
      if (parts[1] === 'status' && method === 'GET') return json({ isConfigured: true, url: supabaseUrl, message: 'Supabase Edge Function active.' });
      if (parts[1] === 'test' && method === 'POST') {
        const { error } = await db.from('exchange_rates').select('id').limit(1).maybeSingle();
        return error
          ? json({ success: false, tablesStatus: 'error', message: error.message })
          : json({ success: true, tablesStatus: 'ready', message: 'Connexion Supabase et table des taux opérationnelles.' });
      }
      if (parts[1] === 'counts' && method === 'GET') {
        const counts: Record<string, number> = {};
        for (const name of ['parcels','clients','shipments','payments','expenses','employees','salary_payments','users','agencies','exchange_rates','audit_logs','notifications']) {
          const { count, error } = await db.from(name).select('*', { count: 'exact', head: true });
          if (error) throw error;
          counts[name] = count || 0;
        }
        return json(counts);
      }
      return json({ error: 'Cette opération de synchronisation/configuration locale n’est plus disponible.' }, 410);
    }

    if (method === 'GET' && route === 'auth' && parts[1] === 'login') return json({ error: 'Utilisez Supabase Auth.' }, 410);

    if (route === 'stats' && method === 'GET') {
      const stats = await calculateStats(scoped, actor!);
      if (!['admin', 'cashier'].includes(actor!.role)) delete (stats as any).finances;
      return json(stats);
    }
    if (table === 'notifications' && method === 'GET') {
      const rows = await list('notifications', 'timestamp', scoped);
      const visible = rows.filter((item: any) => item.targetRole === 'ALL' || item.targetRole === actor!.role);
      if (actor!.role !== 'client') return json(visible);
      // Clients only see notifications about their own parcels (others name other clients).
      const mine = await clientTrackingNumbers(actor!);
      return json(visible.filter((item: any) => item.parcelTracking && mine.includes(item.parcelTracking)));
    }
    if (table === 'notifications' && method === 'POST' && parts[1] === 'mark-read') {
      const notificationId = (body as any).id;
      if (typeof notificationId !== 'string' || !notificationId) return json({ error: 'Notification requise.' }, 400);
      // Each role may only mark the notifications it can see.
      let query = db.from('notifications').update({ is_read: true }).in('target_role', ['ALL', actor!.role]);
      if (actor!.role === 'client') query = query.in('parcel_tracking', await clientTrackingNumbers(actor!));
      query = notificationId === 'all' ? query.eq('is_read', false) : query.eq('id', notificationId);
      const { error } = await query;
      if (error) throw error;
      return json({ success: true });
    }
    if (route === 'exchange-rates' && method === 'PUT') {
      // Merge with the stored row so a partial update never resets other values.
      const input = body as any;
      const existingRow = await loadRatesRow();
      const current = ratesResponse(existingRow);
      const positive = (value: unknown, fallback: number, label: string, allowZero = false) => {
        if (value === undefined || value === null || value === '') return fallback;
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) throw new ApiError(400, `${label} invalide : saisissez un nombre ${allowZero ? 'positif ou nul' : 'strictement positif'}.`);
        return n;
      };
      if (input.freightRateCurrency !== undefined && !isPricingCurrency(input.freightRateCurrency)) {
        throw new ApiError(400, 'Devise du tarif au kg non prise en charge (USD, CNY, CDF ou AOA).');
      }
      const rates = {
        id: existingRow?.id ?? 1,
        usd_rate: 1,
        cny_rate: positive(input.CNY, current.CNY, 'Taux CNY'),
        cdf_rate: positive(input.CDF, current.CDF, 'Taux CDF'),
        aoa_rate: positive(input.AOA, current.AOA, 'Taux AOA'),
        maritime_price_per_kg: roundMoney(positive(input.maritimePricePerKg, current.maritimePricePerKg, 'Tarif maritime/kg', true)),
        maritime_price_per_cbm: roundMoney(positive(input.maritimePricePerCbm, current.maritimePricePerCbm, 'Tarif maritime/CBM', true)),
        aerien_price_per_kg: roundMoney(positive(input.aerienPricePerKg, current.aerienPricePerKg, 'Tarif aérien/kg', true)),
        freight_rate_currency: input.freightRateCurrency ?? current.freightRateCurrency,
        aerien_transit_days: input.aerienTransitDays !== undefined ? parseTransitDays(input.aerienTransitDays, 'Délai aérien') : current.aerienTransitDays,
        maritime_transit_days: input.maritimeTransitDays !== undefined ? parseTransitDays(input.maritimeTransitDays, 'Délai maritime') : current.maritimeTransitDays,
        last_updated: today(),
      };
      const { data: saved, error } = await db.from('exchange_rates').upsert(rates).select('*').single();
      if (error) throw error;
      const tariffChanged = rates.maritime_price_per_cbm !== current.maritimePricePerCbm || rates.aerien_price_per_kg !== current.aerienPricePerKg || rates.freight_rate_currency !== current.freightRateCurrency || rates.aerien_transit_days !== current.aerienTransitDays || rates.maritime_transit_days !== current.maritimeTransitDays;
      await audit(actor!, 'UPDATE', 'SETTINGS', 'EXCHANGE_RATES',
        tariffChanged
          ? `Mise à jour des taux et des tarifs fret (aérien ${rates.aerien_price_per_kg} ${rates.freight_rate_currency}/kg, maritime ${rates.maritime_price_per_cbm} ${rates.freight_rate_currency}/CBM ; délais aérien ${rates.aerien_transit_days ?? '—'} j, maritime ${rates.maritime_transit_days ?? '—'} j)`
          : 'Mise à jour des taux de change',
        current, ratesResponse(saved));
      return json(ratesResponse(saved));
    }
    if (route === 'exchange-rates' && method === 'GET') {
      return json(ratesResponse(await loadRatesRow()));
    }

    if (route === 'uploads' && parts[1] === 'parcel-photo' && method === 'POST') {
      const dataUrl = (body as any).dataUrl;
      const match = typeof dataUrl === 'string' ? dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
      if (!match) throw new ApiError(400, 'Format de photo non pris en charge (JPEG, PNG ou WebP uniquement).');
      const binary = atob(match[2]);
      if (binary.length > MAX_PHOTO_BYTES) throw new ApiError(413, 'Photo trop volumineuse (5 Mo maximum).');
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const extension = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg';
      const path = `parcels/${today().slice(0, 7)}/${crypto.randomUUID()}.${extension}`;
      const { error } = await db.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: match[1], upsert: false });
      if (error) {
        if (/bucket not found/i.test(error.message || '')) throw new ApiError(503, 'Stockage des photos non configuré : appliquez la migration 202610110003_parcel_photos_storage.sql.');
        throw error;
      }
      const { data } = db.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      return json({ url: data.publicUrl }, 201);
    }

    if (!tables.has(table)) return json({ error: 'Route introuvable.' }, 404);
    if (['users', 'agencies', 'clients', 'parcels', 'shipments', 'payments', 'expenses', 'employees', 'salary_payments', 'audit_logs', 'notifications'].includes(table) && method === 'GET' && !resourceId) {
      const sort = table === 'agencies' ? 'name' : table === 'employees' ? 'hire_date' : table === 'audit_logs' || table === 'notifications' ? 'timestamp' : table === 'salary_payments' ? 'payment_date' : 'created_at';
      const records = await list(table, sort, scoped);
      let filtered = records;
      if (actor!.role === 'client' && table === 'parcels') {
        filtered = records.filter((row: any) => ownsParcel(actor!, { client_id: row.clientId, sender_client_id: row.senderClientId }));
      }
      if (actor!.role === 'client' && table === 'payments') {
        filtered = actor!.client_id ? records.filter((row: any) => row.clientId === actor!.client_id) : [];
      }
      if (table === 'clients') {
        // Lets agents see which client files already have a self-service account.
        const { data: linked, error: linkedError } = await db.from('users').select('client_id').not('client_id', 'is', null);
        if (linkedError) throw linkedError;
        const withAccount = new Set(((linked || []) as Array<{ client_id: string }>).map((u) => u.client_id));
        filtered = records.map((row: any) => ({ ...row, hasAccount: withAccount.has(row.id) }));
        // Operations teams use the shared directory but not the clients' financial balances.
        if (['china_team', 'kinshasa_team'].includes(actor!.role)) {
          filtered = filtered.map(({ totalAmountUSD: _a, totalPaidUSD: _p, remainingBalanceUSD: _r, ...rest }: any) => rest);
        }
      }
      if (table === 'users') filtered = records.map(({ password: _password, authUserId: _authUserId, ...safe }: any) => safe);
      if (table === 'audit_logs') filtered = filtered.slice(0, 200);
      if (table === 'notifications') filtered = filtered.filter((row: any) => row.targetRole === 'ALL' || row.targetRole === actor!.role).slice(0, 100);
      return json(filtered);
    }

    if (table === 'track') return json({ error: 'Route introuvable.' }, 404);

    if (table === 'clients' && resourceId && parts[2] === 'activation-code' && method === 'POST') {
      const { data: client, error: clientError } = await db.from('clients').select('id,full_name,code').eq('id', resourceId).maybeSingle();
      if (clientError) throw clientError;
      if (!client) return json({ error: 'Client non trouvé.' }, 404);
      const { data: linkedUser, error: linkedError } = await db.from('users').select('id').eq('client_id', resourceId).maybeSingle();
      if (linkedError) throw linkedError;
      if (linkedUser) return json({ error: 'Ce client possède déjà un compte. Aucun nouveau code n’est nécessaire.' }, 409);
      // Only one valid code at a time: expire the previous unused ones.
      const nowIso = new Date().toISOString();
      const { error: expireError } = await db.from('client_activation_codes').update({ expires_at: nowIso }).eq('client_id', resourceId).is('used_at', null);
      if (expireError) throw expireError;
      const code = generateActivationCode();
      const expiresAt = new Date(Date.now() + ACTIVATION_CODE_TTL_MS).toISOString();
      const { error } = await db.from('client_activation_codes').insert({ id: id('ACT'), client_id: resourceId, code_hash: await sha256Hex(normalizeActivationCode(code)), expires_at: expiresAt, created_by: actor!.id });
      if (error) throw error;
      await audit(actor!, 'CREATE', 'CLIENT', resourceId, `Code d’activation de compte émis pour ${client.full_name} (${client.code}), valable 7 jours`);
      return json({ code, expiresAt }, 201);
    }
    if (table === 'clients' && method === 'POST' && !resourceId) {
      const seq = await nextSequence('client');
      const client = { id: id('CLI'), code: `CLI-${String(seq).padStart(3, '0')}`, full_name: (body as any).fullName, phone: (body as any).phone, email: (body as any).email || '', address: (body as any).address || '', city: (body as any).city || 'Kinshasa', country: (body as any).country || 'RDC', total_parcels: 0, total_amount_usd: 0, total_paid_usd: 0, remaining_balance_usd: 0, created_at: today(), notes: (body as any).notes || '' };
      const { error } = await db.from('clients').insert(client);
      if (error) throw error;
      await audit(actor!, 'CREATE', 'CLIENT', client.id, `Création du client ${client.full_name}`);
      return json(fromRow(client), 201);
    }
    if (route === 'payment-methods' && method === 'GET') {
      const { data, error } = await scoped.from('payment_methods').select('*').order('country').order('sort_order');
      if (error) throw error;
      return json((data || []).map(fromRow));
    }
    if (route === 'payment-methods' && method === 'POST' && !resourceId) {
      const input = body as any;
      const country = String(input.country || '');
      const label = String(input.label || '').trim();
      if (!['Chine', 'RDC', 'Angola'].includes(country)) return json({ error: 'Pays invalide (Chine, RDC ou Angola).' }, 400);
      if (!label) return json({ error: 'Nom du moyen de paiement obligatoire.' }, 400);
      const kind = ['cash', 'bank', 'mobile'].includes(input.kind) ? input.kind : 'mobile';
      const code = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
      if (!code) return json({ error: 'Nom du moyen de paiement invalide.' }, 400);
      const { data: existing } = await db.from('payment_methods').select('id').eq('country', country).eq('code', code).maybeSingle();
      if (existing) return json({ error: `« ${label} » existe déjà pour la caisse ${country}.` }, 409);
      const { count } = await db.from('payment_methods').select('*', { count: 'exact', head: true }).eq('country', country);
      const row = { id: id('PM'), country, code, label, kind, active: true, sort_order: (count || 0) + 1 };
      const { error } = await db.from('payment_methods').insert(row);
      if (error) throw error;
      await audit(actor!, 'CREATE', 'SETTINGS', row.id, `Ajout du moyen de paiement « ${label} » (caisse ${country})`);
      return json(fromRow(row), 201);
    }
    if (route === 'payment-methods' && method === 'PUT' && resourceId) {
      const input = body as any;
      const patch: Record<string, unknown> = {};
      if (input.label !== undefined) {
        if (!String(input.label).trim()) return json({ error: 'Nom du moyen de paiement obligatoire.' }, 400);
        patch.label = String(input.label).trim();
      }
      if (input.active !== undefined) patch.active = !!input.active;
      if (input.sortOrder !== undefined) patch.sort_order = Number(input.sortOrder) || 0;
      // The code is never changed: past receipts/expenses reference it.
      const { data, error } = await db.from('payment_methods').update(patch).eq('id', resourceId).select('*').maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Moyen de paiement introuvable.' }, 404);
      await audit(actor!, 'UPDATE', 'SETTINGS', resourceId, `Moyen de paiement « ${data.label} » (caisse ${data.country}) ${data.active ? 'actif' : 'désactivé'}`);
      return json(fromRow(data));
    }

    if (table === 'agencies' && method === 'POST' && !resourceId) {
      const input = body as any;
      const text = (value: unknown) => String(value ?? '').trim();
      const name = text(input.name), city = text(input.city), country = text(input.country);
      if (!name || !city) return json({ error: 'Nom et ville de l’agence obligatoires.' }, 400);
      if (!['Chine', 'RDC', 'Angola'].includes(country)) return json({ error: 'Pays invalide (Chine, RDC ou Angola).' }, 400);
      const type = ['origin', 'destination', 'hub'].includes(input.type) ? input.type : country === 'Chine' ? 'origin' : 'destination';
      const seq = await nextSequence('agency');
      const prefix = country === 'Chine' ? 'CN' : country === 'Angola' ? 'AO' : 'CD';
      const agency = { id: id('AG'), code: `${prefix}-${String(seq).padStart(3, '0')}`, name, country, city, address: text(input.address), phone: text(input.phone), email: text(input.email), type, manager_name: text(input.managerName) || null };
      const { error } = await db.from('agencies').insert(agency);
      if (error) throw error;
      await audit(actor!, 'CREATE', 'AGENCY', agency.id, `Création de l’agence ${agency.name} (${agency.country})`);
      return json(fromRow(agency), 201);
    }
    if (table === 'parcels' && method === 'POST' && !resourceId) return json(await createParcel(body, actor!), 201);
    if (table === 'payments' && method === 'POST' && !resourceId) return json(await createPayment(body, actor!, scoped), 201);
    if (table === 'expenses' && method === 'POST' && !resourceId) return json(await createExpense(body, actor!), 201);
    if (table === 'employees' && method === 'POST' && !resourceId) {
      const input = body as any;
      // No invented values: name, salary and agency must be real.
      if (!String(input.fullName || '').trim()) return json({ error: 'Nom de l’employé obligatoire.' }, 400);
      const baseSalary = Number(input.baseSalaryUSD);
      if (!Number.isFinite(baseSalary) || baseSalary <= 0) return json({ error: 'Salaire de base obligatoire (montant supérieur à 0).' }, 400);
      const employeeAgency = await loadAgency(input.agencyId || null, 'Agence');
      const seq = await nextSequence('employee');
      const country = employeeAgency?.country || input.country || 'RDC';
      const countryCode = country === 'Chine' ? 'GZ' : country === 'Angola' ? 'LAD' : 'KIN';
      const employee = { id: id('EMP'), employee_code: `EMP-${countryCode}-${String(seq).padStart(2, '0')}`, full_name: String(input.fullName).trim(), phone: input.phone, job_title: input.jobTitle, agency_id: employeeAgency?.id ?? null, agency_name: employeeAgency?.name ?? null, country, base_salary_usd: baseSalary, preferred_currency: input.preferredCurrency || 'USD', status: 'actif', hire_date: input.hireDate || today() };
      const { error } = await db.from('employees').insert(employee);
      if (error) throw error;
      await audit(actor!, 'CREATE', 'EMPLOYEE', employee.id, `Création employé ${employee.full_name}`);
      return json(fromRow(employee), 201);
    }
    if (table === 'salary_payments' && method === 'POST' && !resourceId) {
      const input = body as any;
      const seq = await nextSequence('salary');
      const { data: ratesRow, error: ratesError } = await db.from('exchange_rates').select('*').limit(1).maybeSingle();
      if (ratesError) throw ratesError;
      const period = input.periodMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const base = Number(input.baseSalaryUSD) || 0, bonus = Number(input.primesUSD) || 0, advances = Number(input.avancesUSD) || 0, deductions = Number(input.retenuesUSD) || 0, overtime = Number(input.overtimeUSD) || 0;
      const net = base + bonus + overtime - advances - deductions;
      const currency = input.currency || 'USD';
      const exchangeRate = currency === 'USD' ? 1 : currency === 'CNY' ? Number(ratesRow?.cny_rate) || 7.25 : currency === 'CDF' ? Number(ratesRow?.cdf_rate) || 2850 : currency === 'AOA' ? Number(ratesRow?.aoa_rate) || 920 : Number(input.exchangeRate) || 1;
      const salary = { id: id('SAL'), slip_number: `PAY-${period}-${String(seq).padStart(3, '0')}`, employee_id: input.employeeId || null, employee_name: input.employeeName, job_title: input.jobTitle || '', agency_name: input.agencyName || actor!.agency_name, country: input.country || '', period_month: period, base_salary_usd: base, primes_usd: bonus, avances_usd: advances, retenues_usd: deductions, overtime_usd: overtime, net_salary_usd: net, paid_amount_original: currency === 'USD' ? net : Number((net * exchangeRate).toFixed(2)), currency, exchange_rate: exchangeRate, payment_date: input.paymentDate || today(), status: input.status || 'PAYE', payment_method: input.paymentMethod || 'Espèces', notes: input.notes || '' };
      let expense: Record<string, unknown> | null = null;
      if (salary.status === 'PAYE') {
        const expenseSeq = await nextSequence('expense');
        expense = { id: id('DEP'), voucher_number: `DEP-${new Date().getFullYear()}-${String(expenseSeq).padStart(4, '0')}`, category: 'salaire', category_label: 'Salaires & Rémunérations', original_amount: salary.paid_amount_original, currency, exchange_rate: exchangeRate, amount_usd: net, agency_id: input.agencyId || actor!.agency_id, agency_name: salary.agency_name, country: salary.country, payment_method: salaryMethodCode(salary.payment_method), beneficiary: salary.employee_name, date: salary.payment_date, time: nowTime(), recorded_by: actor!.full_name, description: `Règlement salaire ${period} [Bulletin ${salary.slip_number}]` };
      }
      const { data, error } = await db.rpc('create_salary_transaction', { salary_data: salary, expense_data: expense, audit_data: auditRow(actor!, 'PAYMENT', 'EMPLOYEE', salary.id, `Émission bulletin ${salary.slip_number} (${net} USD)`) });
      if (error) throw error;
      return json(fromRow(data), 201);
    }

    if (table === 'shipments' && method === 'POST' && !resourceId) {
      // The China team only opens shipments departing from its own agency.
      const departureId = actor!.role === 'china_team' ? actor!.agency_id : (body as any).departureAgencyId || null;
      if (actor!.role === 'china_team' && !departureId) throw new ApiError(403, 'Aucune agence Chine ne vous est attribuée. Contactez l’administrateur.');
      const departureAgency = await loadAgency(departureId, 'Agence de départ');
      const arrivalAgency = await loadAgency((body as any).destinationAgencyId || null, 'Agence de destination');
      const seq = await nextSequence('shipment');
      const shipment = { id: id('SHIP'), shipment_number: `EXP-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`, departure_agency_id: departureAgency?.id ?? null, departure_agency_name: departureAgency?.name ?? '', destination: (body as any).destination || '', destination_agency_id: arrivalAgency?.id ?? null, destination_agency_name: arrivalAgency?.name ?? '', transport_mode: (body as any).transportMode || 'MARITIME', carrier_name: (body as any).carrierName || '', container_or_flight_number: (body as any).containerOrFlightNumber || '', departure_date: (body as any).departureDate || null, estimated_arrival_date: (body as any).estimatedArrivalDate || null, actual_arrival_date: null, parcel_count: 0, total_weight_kg: 0, total_volume_cbm: 0, total_cost_usd: Number((body as any).totalCostUSD) || 0, status: 'EN_PREPARATION', parcel_ids: [], comments: (body as any).comments || '', created_at: today(), updated_at: today() };
      const { error } = await db.from('shipments').insert(shipment);
      if (error) throw error;
      await audit(actor!, 'CREATE', 'SHIPMENT', shipment.id, `Création de l’expédition ${shipment.shipment_number}`);
      return json(fromRow(shipment), 201);
    }
    if (table === 'shipments' && resourceId && method === 'PUT') {
      const patch = toRow(body as Record<string, unknown>);
      delete patch.id; delete patch.parcel_ids; delete patch.parcel_count;
      const { data, error } = await db.from('shipments').update({ ...patch, updated_at: today() }).eq('id', resourceId).select('*').maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Expédition non trouvée.' }, 404);
      await audit(actor!, 'UPDATE', 'SHIPMENT', resourceId, `Mise à jour de l’expédition ${data.shipment_number}`);
      return json(fromRow(data));
    }

    if (table === 'parcels' && resourceId && parts[2] === 'status' && method === 'POST') {
      const { data: parcel, error } = await db.from('parcels').select('*').eq('id', resourceId).maybeSingle();
      if (error) throw error;
      if (!parcel) return json({ error: 'Colis non trouvé.' }, 404);
      const update = body as any;
      const date = today(), status = update.status;
      if (!status) return json({ error: 'Statut requis.' }, 400);
      const chinaStatuses = ['RECU_CHINE', 'IDENTIFIE', 'CONTROLE', 'PREPARE_EXPEDITION', 'EXPEDITION_EN_PREPARATION', 'EXPEDIE', 'EN_TRANSIT', 'ANOMALIE'];
      const destinationStatuses = ['ARRIVE_DESTINATION', 'DEDOUANEMENT_TRAITEMENT', 'DISPONIBLE_AGENCE', 'PREPARATION_LIVRAISON', 'EN_COURS_LIVRAISON', 'LIVRE', 'RETIRE_CLIENT', 'ANOMALIE'];
      const allStatuses = [...chinaStatuses, ...destinationStatuses, 'COMMANDE_CREEE', 'ATTENTE_RECEPTION_CHINE'];
      if (!allStatuses.includes(status)) return json({ error: 'Statut colis invalide.' }, 400);
      if (actor!.role === 'china_team' && !chinaStatuses.includes(status)) return json({ error: 'Votre rôle ne permet pas ce statut.' }, 403);
      if (actor!.role === 'kinshasa_team' && !destinationStatuses.includes(status)) return json({ error: 'Votre rôle ne permet pas ce statut.' }, 403);
      const history = [...(parcel.status_history || []), { id: id('SH'), status, date, time: nowTime(), user: actor!.full_name, agency: actor!.agency_name, comment: update.comment || `Mise à jour du statut vers ${status}` }];
      const patch: Record<string, unknown> = { status, status_history: history, updated_at: date };
      for (const key of ['warehouseLocation','deliveryDriverName','deliveryDriverPhone','deliveryRecipient']) if (update[key]) patch[camelToSnake(key)] = update[key];
      const notification = status === 'DISPONIBLE_AGENCE' || status === 'LIVRE' || status === 'RETIRE_CLIENT' || status === 'ANOMALIE'
        ? notificationRow(status === 'DISPONIBLE_AGENCE' ? 'PARCEL_READY' : status === 'ANOMALIE' ? 'ANOMALY' : 'PARCEL_DELIVERED', `Mise à jour ${parcel.tracking_number}`, update.comment || `Nouveau statut : ${status}`, 'ALL', parcel.tracking_number)
        : null;
      const { data, error: updateError } = await db.rpc('update_parcel_status_transaction', {
        target_id: resourceId,
        next_status: status,
        history_item: history.at(-1),
        patch: toRow(update),
        audit_data: auditRow(actor!, 'STATUS_CHANGE', 'PARCEL', resourceId, `Colis ${parcel.tracking_number}: ${parcel.status} → ${status}`, parcel.status, status),
        notification_data: notification,
      });
      if (updateError) throw updateError;
      return json(fromRow(data));
    }

    if (table === 'shipments' && resourceId && parts[2] === 'depart' && method === 'POST') {
      const { data: shipment, error } = await db.from('shipments').select('*').eq('id', resourceId).maybeSingle();
      if (error) throw error;
      if (!shipment) return json({ error: 'Expédition non trouvée.' }, 404);
      if (!['EN_PREPARATION', 'EXPEDIE', 'EN_TRANSIT'].includes(shipment.status)) return json({ error: `Transition départ impossible depuis le statut ${shipment.status}.` }, 400);
      const date = (body as any).departureDate || today();
      const { data, error: transitionError } = await db.rpc('transition_shipment_transaction', {
        target_id: resourceId, transition: 'depart', event_date: date, actor_name: actor!.full_name,
        actor_agency: actor!.agency_name,
        audit_data: auditRow(actor!, 'STATUS_CHANGE', 'SHIPMENT', resourceId, `Départ validé pour ${shipment.shipment_number}.`),
        notification_data: notificationRow('SHIPMENT_DEPARTED', `Expédition ${shipment.shipment_number} partie`, `Expédition en route vers ${shipment.destination}.`, 'ALL'),
      });
      if (transitionError) throw transitionError;
      return json(fromRow(data));
    }
    if (table === 'shipments' && resourceId && parts[2] === 'arrive' && method === 'POST') {
      const { data: shipment, error } = await db.from('shipments').select('*').eq('id', resourceId).maybeSingle();
      if (error) throw error;
      if (!shipment) return json({ error: 'Expédition non trouvée.' }, 404);
      if (!['EXPEDIE', 'EN_TRANSIT'].includes(shipment.status)) return json({ error: `Transition arrivée impossible depuis le statut ${shipment.status}.` }, 400);
      const date = (body as any).actualArrivalDate || today();
      const { data, error: transitionError } = await db.rpc('transition_shipment_transaction', {
        target_id: resourceId, transition: 'arrive', event_date: date, actor_name: actor!.full_name,
        actor_agency: actor!.agency_name,
        audit_data: auditRow(actor!, 'STATUS_CHANGE', 'SHIPMENT', resourceId, `Arrivée enregistrée pour ${shipment.shipment_number}.`),
        notification_data: notificationRow('SHIPMENT_ARRIVED', `Expédition ${shipment.shipment_number} arrivée`, `Arrivée à ${shipment.destination}.`, 'ALL'),
      });
      if (transitionError) throw transitionError;
      return json(fromRow(data));
    }
    if (table === 'shipments' && resourceId && parts[2] === 'parcels' && method === 'POST') {
      const parcelIds = (body as any).parcelIds;
      if (!Array.isArray(parcelIds) || parcelIds.some((value) => typeof value !== 'string')) return json({ error: 'Liste parcelIds invalide.' }, 400);
      if (actor!.role !== 'admin' && parcelIds.length > 0) {
        const { data: visibleParcels, error: visibleError } = await scoped.from('parcels').select('id').in('id', parcelIds);
        if (visibleError) throw visibleError;
        if ((visibleParcels || []).length !== new Set(parcelIds).size) return json({ error: 'Certains colis sont introuvables ou hors de votre agence.' }, 403);
      }
      const { data, error } = await db.rpc('link_parcels_to_shipment_transaction', {
        target_shipment_id: resourceId, target_parcel_ids: parcelIds, actor_name: actor!.full_name,
        audit_data: auditRow(actor!, 'UPDATE', 'SHIPMENT', resourceId, `Ajout de ${parcelIds.length} colis à l’expédition.`),
      });
      if (error) throw error;
      return json(fromRow(data));
    }

    if (table === 'users' && method === 'POST' && !resourceId) {
      const input = body as any;
      if (!input.email || !input.fullName || !input.username || !input.role) return json({ error: 'Nom, identifiant, rôle et e-mail requis.' }, 400);
      // Validate role + agency before sending the invitation e-mail.
      const agency = await resolveStaffAgency(input.role, input.agencyId);
      const email = String(input.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Adresse e-mail invalide.' }, 400);
      // With an initial password the account is usable immediately (no e-mail sent);
      // otherwise Supabase sends an invitation e-mail. The password never leaves Supabase Auth.
      let authResult;
      if (input.password !== undefined && input.password !== '') {
        if (String(input.password).length < 8) return json({ error: 'Le mot de passe initial doit contenir au moins 8 caractères.' }, 400);
        authResult = await db.auth.admin.createUser({ email, password: String(input.password), email_confirm: true, user_metadata: { full_name: input.fullName } });
      } else {
        authResult = await db.auth.admin.inviteUserByEmail(email, { data: { full_name: input.fullName } });
      }
      const { data: invited, error: inviteError } = authResult;
      if (inviteError) {
        if (/already|registered|exists/i.test(inviteError.message || '')) return json({ error: 'Cette adresse e-mail a déjà un compte.' }, 409);
        throw inviteError;
      }
      input.email = email;
      const user = { id: id('USR'), username: input.username, full_name: input.fullName, email: input.email, phone: input.phone || '', role: input.role, agency_id: agency?.id ?? null, agency_name: agency?.name ?? null, status: 'active', created_at: new Date().toISOString(), auth_user_id: invited.user.id };
      const { error } = await db.from('users').insert(user);
      if (error) { await db.auth.admin.deleteUser(invited.user.id); throw error; }
      await audit(actor!, 'CREATE', 'USER', user.id, `${input.password ? 'Création' : 'Invitation'} de ${user.full_name} (${user.role}${user.agency_name ? ' • ' + user.agency_name : ''})`);
      const { auth_user_id: _authId, ...safe } = user;
      return json(fromRow(safe), 201);
    }

    if (table === 'users' && method === 'PUT' && resourceId) {
      const input = body as any;
      const patch: Record<string, unknown> = {};
      for (const [source, target] of [['username','username'],['fullName','full_name'],['email','email'],['phone','phone'],['status','status']]) {
        if (input[source] !== undefined) patch[target] = input[source];
      }
      if (input.status !== undefined && !['active', 'inactive'].includes(String(input.status))) return json({ error: 'Statut invalide.' }, 400);
      if (input.role !== undefined || input.agencyId !== undefined) {
        const { data: current, error: currentError } = await db.from('users').select('role,agency_id,client_id').eq('id', resourceId).maybeSingle();
        if (currentError) throw currentError;
        if (!current) return json({ error: 'Utilisateur non trouvé.' }, 404);
        if (current.role === 'client') return json({ error: 'Le rôle et l’agence d’un compte client ne se modifient pas : il reste lié à sa fiche client.' }, 400);
        if (resourceId === actor!.id && input.role !== undefined && input.role !== 'admin') return json({ error: 'Vous ne pouvez pas retirer votre propre rôle administrateur.' }, 400);
        const role = input.role ?? current.role;
        const agency = await resolveStaffAgency(role, input.agencyId !== undefined ? input.agencyId : current.agency_id);
        patch.role = role;
        patch.agency_id = agency?.id ?? null;
        patch.agency_name = agency?.name ?? null;
      }
      if (resourceId === actor!.id && patch.status === 'inactive') return json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' }, 400);
      const { data: beforeUser, error: beforeError } = await db.from('users').select('*').eq('id', resourceId).maybeSingle();
      if (beforeError) throw beforeError;
      if (!beforeUser) return json({ error: 'Utilisateur non trouvé.' }, 404);
      if (patch.email !== undefined) {
        patch.email = String(patch.email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patch.email))) return json({ error: 'Adresse e-mail invalide.' }, 400);
        if (patch.email !== beforeUser.email && beforeUser.auth_user_id) {
          const { error: emailError } = await db.auth.admin.updateUserById(beforeUser.auth_user_id, { email: patch.email, email_confirm: true });
          if (emailError) throw new ApiError(400, `Changement d’e-mail refusé : ${emailError.message}`);
        }
      }
      const { data, error } = await db.from('users').update(patch).eq('id', resourceId).select('*').maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Utilisateur non trouvé.' }, 404);
      const userKeys = ['username', 'full_name', 'email', 'phone', 'role', 'agency_name', 'status'];
      await audit(actor!, 'UPDATE', 'USER', resourceId, `Mise à jour du profil ${data.username}`, pick(beforeUser, userKeys), pick(data, userKeys));
      const { auth_user_id: _authUserId, ...safe } = data;
      return json(fromRow(safe));
    }

    // Admin-only password reset: the new password goes straight to Supabase Auth, never stored or logged.
    if (table === 'users' && resourceId && parts[2] === 'password' && method === 'POST') {
      const password = String((body as any).password ?? '');
      if (password.length < 8) return json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' }, 400);
      const { data: target, error: targetError } = await db.from('users').select('id,full_name,auth_user_id,role').eq('id', resourceId).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return json({ error: 'Utilisateur non trouvé.' }, 404);
      if (!target.auth_user_id) return json({ error: 'Ce profil n’a pas de compte de connexion.' }, 400);
      const { error: pwdError } = await db.auth.admin.updateUserById(target.auth_user_id, { password });
      if (pwdError) throw new ApiError(400, `Réinitialisation refusée : ${pwdError.message}`);
      await audit(actor!, 'UPDATE', 'USER', resourceId, `Réinitialisation du mot de passe de ${target.full_name}`);
      return json({ success: true, message: `Mot de passe de ${target.full_name} réinitialisé.` });
    }

    // Correction of a receipt: amount/currency/method/date; balances recalculated in SQL.
    if (table === 'payments' && resourceId && method === 'PUT') {
      const input = body as any;
      const { data: before, error: beforeError } = await db.from('payments').select('*').eq('id', resourceId).maybeSingle();
      if (beforeError) throw beforeError;
      if (!before) return json({ error: 'Paiement non trouvé.' }, 404);
      const amount = input.originalAmount !== undefined ? Number(input.originalAmount) : Number(before.original_amount);
      if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'Le montant doit être supérieur à 0.' }, 400);
      const currency = input.currency ?? before.currency;
      const { exchangeRate, amountUSD } = correctionToUsd(amount, currency, before, ratesResponse(await loadRatesRow()));
      // Only the admin may move a receipt to another cash box (e.g. receipts recorded without agency).
      const agencyChanged = input.agencyId !== undefined && input.agencyId !== before.agency_id;
      if (agencyChanged && actor!.role !== 'admin') return json({ error: 'Seul l’administrateur peut changer la caisse d’un encaissement.' }, 403);
      const cashAgency = agencyChanged ? await loadAgency(input.agencyId ? String(input.agencyId) : null, 'Agence') : await loadAgency(before.agency_id, 'Agence');
      if (agencyChanged && !cashAgency) return json({ error: 'Choisissez l’agence (caisse) de cet encaissement.' }, 400);
      const methodChanged = input.paymentMethod !== undefined && input.paymentMethod !== before.payment_method;
      const patch = {
        original_amount: roundMoney(amount), currency, exchange_rate: exchangeRate, amount_usd: amountUSD,
        agency_id: cashAgency?.id ?? null, agency_name: cashAgency?.name ?? before.agency_name,
        payment_method: methodChanged || agencyChanged
          ? await assertPaymentMethod(cashAgency?.country || '', input.paymentMethod ?? before.payment_method)
          : before.payment_method,
        reference: input.reference ?? before.reference,
        notes: input.notes ?? before.notes, type: input.type ?? before.type,
        date: input.date !== undefined ? parseDay(input.date, 'Date du paiement') : before.date,
      };
      const keys = ['original_amount', 'currency', 'amount_usd', 'agency_name', 'payment_method', 'reference', 'notes', 'type', 'date'];
      const { data, error } = await db.rpc('update_payment_transaction', {
        target_id: resourceId, patch,
        audit_data: auditRow(actor!, 'UPDATE', 'PAYMENT', resourceId, `Correction du reçu ${before.receipt_number} : ${before.original_amount} ${before.currency} → ${patch.original_amount} ${patch.currency}`, pick(before, keys), pick(patch, keys)),
      });
      if (error) correctionError(error, 'Paiement');
      return json(fromRow(data));
    }

    if (table === 'expenses' && resourceId && method === 'PUT') {
      const input = body as any;
      const { data: before, error: beforeError } = await db.from('expenses').select('*').eq('id', resourceId).maybeSingle();
      if (beforeError) throw beforeError;
      if (!before) return json({ error: 'Dépense non trouvée.' }, 404);
      if (before.category === 'salaire' || input.category === 'salaire') {
        return json({ error: 'Cette dépense provient d’un bulletin de salaire : modifiez ou supprimez le bulletin dans « Salaires ».' }, 400);
      }
      const amount = input.originalAmount !== undefined ? Number(input.originalAmount) : Number(before.original_amount);
      if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'Le montant doit être supérieur à 0.' }, 400);
      const country = input.country ?? before.country;
      if (!['Chine', 'RDC', 'Angola'].includes(country)) return json({ error: 'Pays invalide (Chine, RDC ou Angola).' }, 400);
      const currency = input.currency ?? before.currency;
      const { exchangeRate, amountUSD } = correctionToUsd(amount, currency, before, ratesResponse(await loadRatesRow()));
      const patch = {
        category: input.category ?? before.category, category_label: input.categoryLabel ?? input.category ?? before.category_label,
        original_amount: roundMoney(amount), currency, exchange_rate: exchangeRate, amount_usd: amountUSD,
        beneficiary: input.beneficiary ?? before.beneficiary, description: input.description ?? before.description, country,
        payment_method: input.paymentMethod !== undefined && input.paymentMethod !== before.payment_method
          ? await assertPaymentMethod(country, input.paymentMethod)
          : before.payment_method,
        date: input.date !== undefined ? parseDay(input.date, 'Date de la dépense') : before.date,
      };
      const keys = ['category_label', 'original_amount', 'currency', 'amount_usd', 'beneficiary', 'description', 'country', 'payment_method', 'date'];
      const { data, error } = await db.rpc('update_expense_transaction', {
        target_id: resourceId, patch,
        audit_data: auditRow(actor!, 'UPDATE', 'EXPENSE', resourceId, `Correction de la dépense ${before.voucher_number} : ${before.original_amount} ${before.currency} → ${patch.original_amount} ${patch.currency}`, pick(before, keys), pick(patch, keys)),
      });
      if (error) correctionError(error, 'Dépense');
      return json(fromRow(data));
    }

    if (table === 'salary_payments' && resourceId && method === 'PUT') {
      const input = body as any;
      const { data: before, error: beforeError } = await db.from('salary_payments').select('*').eq('id', resourceId).maybeSingle();
      if (beforeError) throw beforeError;
      if (!before) return json({ error: 'Bulletin de paie non trouvé.' }, 404);
      const num = (key: string, column: string) => {
        const value = input[key] !== undefined ? Number(input[key]) : Number(before[column] || 0);
        if (!Number.isFinite(value) || value < 0) throw new ApiError(400, 'Les montants du bulletin doivent être positifs ou nuls.');
        return roundMoney(value);
      };
      const base = num('baseSalaryUSD', 'base_salary_usd'), primes = num('primesUSD', 'primes_usd'), avances = num('avancesUSD', 'avances_usd');
      const retenues = num('retenuesUSD', 'retenues_usd'), overtime = num('overtimeUSD', 'overtime_usd');
      const net = roundMoney(base + primes + overtime - avances - retenues);
      if (net < 0) return json({ error: 'Le salaire net ne peut pas être négatif (avances et retenues trop élevées).' }, 400);
      const currency = input.currency ?? before.currency;
      const { exchangeRate } = correctionToUsd(1, currency, before, ratesResponse(await loadRatesRow()));
      const patch = {
        base_salary_usd: base, primes_usd: primes, avances_usd: avances, retenues_usd: retenues, overtime_usd: overtime, net_salary_usd: net,
        paid_amount_original: currency === 'USD' ? net : roundMoney(net * exchangeRate), currency, exchange_rate: exchangeRate,
        payment_method: input.paymentMethod ?? before.payment_method, notes: input.notes ?? before.notes,
        payment_date: input.paymentDate !== undefined ? parseDay(input.paymentDate, 'Date de paiement') : before.payment_date,
      };
      const keys = ['base_salary_usd', 'primes_usd', 'avances_usd', 'retenues_usd', 'overtime_usd', 'net_salary_usd', 'currency', 'payment_method', 'payment_date', 'notes'];
      const { data, error } = await db.rpc('update_salary_transaction', {
        target_id: resourceId, patch,
        audit_data: auditRow(actor!, 'UPDATE', 'SALARY', resourceId, `Correction du bulletin ${before.slip_number} : net ${before.net_salary_usd} → ${net} USD`, pick(before, keys), pick(patch, keys)),
      });
      if (error) correctionError(error, 'Bulletin de paie');
      return json(fromRow(data));
    }

    if (method === 'GET' && resourceId && table !== 'supabase') {
      const { data, error } = await scoped.from(table).select('*').eq('id', resourceId).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Enregistrement non trouvé.' }, 404);
      if (actor!.role === 'client' && table === 'parcels' && !ownsParcel(actor!, data)) return json({ error: 'Colis non trouvé.' }, 404);
      if (actor!.role === 'client' && table === 'payments' && (!actor!.client_id || data.client_id !== actor!.client_id)) return json({ error: 'Paiement non trouvé.' }, 404);
      if (table === 'clients' && ['china_team', 'kinshasa_team'].includes(actor!.role)) {
        const { total_amount_usd: _a, total_paid_usd: _p, remaining_balance_usd: _r, ...rest } = data;
        return json(fromRow(rest));
      }
      if (table === 'users') {
        const { password: _password, auth_user_id: _authUserId, ...safe } = data;
        return json(fromRow(safe));
      }
      return json(fromRow(data));
    }

    if (['PUT','PATCH'].includes(method) && resourceId) {
      const patch = toRow(body as Record<string, unknown>);
      delete patch.id;
      delete patch.auth_user_id;
      delete patch.password;
      if (table === 'employees') {
        if (patch.full_name !== undefined && !String(patch.full_name).trim()) return json({ error: 'Nom de l’employé obligatoire.' }, 400);
        if (patch.base_salary_usd !== undefined && !(Number(patch.base_salary_usd) > 0)) return json({ error: 'Salaire de base obligatoire (montant supérieur à 0).' }, 400);
        if (patch.agency_id !== undefined) {
          const employeeAgency = await loadAgency(patch.agency_id ? String(patch.agency_id) : null, 'Agence');
          patch.agency_id = employeeAgency?.id ?? null;
          patch.agency_name = employeeAgency?.name ?? null;
          if (employeeAgency) patch.country = employeeAgency.country;
        }
        if (patch.status !== undefined && !['actif', 'inactif', 'conge'].includes(String(patch.status))) return json({ error: 'Statut employé invalide.' }, 400);
      }
      if (table === 'clients') {
        for (const key of ['total_parcels', 'total_amount_usd', 'total_paid_usd', 'remaining_balance_usd', 'code']) delete patch[key];
        if (patch.full_name !== undefined && !String(patch.full_name).trim()) return json({ error: 'Nom du client obligatoire.' }, 400);
        if (patch.phone !== undefined && !String(patch.phone).trim()) return json({ error: 'Téléphone du client obligatoire.' }, 400);
      }
      if (table === 'parcels') {
        // Totals, payments and the tariff snapshot are derived server-side only.
        // The transport mode fixes the pricing basis (kg / CBM) and is frozen too.
        for (const key of ['total_cost_usd', 'amount_paid_usd', 'remaining_amount_usd', 'price_per_kg', 'price_per_cbm', 'pricing_unit', 'pricing_exchange_rate', 'pricing_currency', 'freight_amount', 'total_amount', 'transport_mode', 'estimated_arrival_date']) delete patch[key];
        if (patch.estimated_transit_days !== undefined || patch.china_reception_date !== undefined) {
          const { data: current, error: currentError } = await db.from('parcels').select('china_reception_date, created_at, estimated_transit_days').eq('id', resourceId).maybeSingle();
          if (currentError) throw currentError;
          if (!current) return json({ error: 'Colis non trouvé.' }, 404);
          if (patch.estimated_transit_days !== undefined) patch.estimated_transit_days = parseTransitDays(patch.estimated_transit_days, 'Délai d’acheminement');
          if (patch.china_reception_date !== undefined) patch.china_reception_date = parseDay(patch.china_reception_date, 'Date de réception');
          const days = patch.estimated_transit_days !== undefined ? patch.estimated_transit_days : current.estimated_transit_days;
          const start = String(patch.china_reception_date ?? current.china_reception_date ?? current.created_at ?? '').slice(0, 10);
          patch.estimated_arrival_date = days !== null && days !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(start) ? addDays(start, Number(days)) : null;
        }
        const measureKeys = ['weight_kg', 'length_cm', 'width_cm', 'height_cm', 'volume_cbm', 'transport_cost_usd', 'extra_fees_usd'];
        if (measureKeys.some((key) => patch[key] !== undefined)) {
          const { data: existing, error: existingError } = await db.from('parcels').select('*').eq('id', resourceId).maybeSingle();
          if (existingError) throw existingError;
          if (!existing) return json({ error: 'Colis non trouvé.' }, 404);
          // Parcels priced before CBM pricing have no pricing_unit: kg if a kg tariff was frozen.
          const unit = existing.pricing_unit || (Number(existing.price_per_kg) > 0 ? 'KG' : null);
          const weight = Number(patch.weight_kg ?? existing.weight_kg ?? 0);
          const extraUSD = Number(patch.extra_fees_usd ?? existing.extra_fees_usd ?? 0);
          const dims = [patch.length_cm ?? existing.length_cm, patch.width_cm ?? existing.width_cm, patch.height_cm ?? existing.height_cm];
          for (const dim of dims) if (dim !== null && dim !== undefined && (!Number.isFinite(Number(dim)) || Number(dim) < 0)) throw new ApiError(400, 'Les dimensions doivent être des nombres positifs (cm).');
          const dimsChanged = ['length_cm', 'width_cm', 'height_cm'].some((key) => patch[key] !== undefined);
          const dimsVolume = volumeFromDimensionsCm(dims[0], dims[1], dims[2]);
          if (dimsChanged && dimsVolume === null) throw new ApiError(400, 'Longueur, largeur et hauteur doivent toutes être supérieures à 0 (cm).');
          const volume = dimsVolume ?? Number(patch.volume_cbm ?? existing.volume_cbm ?? 0);
          if (!Number.isFinite(weight) || weight < 0 || (unit !== 'CBM' && weight <= 0)) throw new ApiError(400, 'Le poids doit être un nombre supérieur à 0 kg.');
          if (unit === 'CBM' && !(volume > 0)) throw new ApiError(400, 'Saisissez la longueur, la largeur et la hauteur (en cm, supérieures à 0) pour calculer le volume.');
          if (!Number.isFinite(extraUSD) || extraUSD < 0) throw new ApiError(400, 'Les frais annexes ne peuvent pas être négatifs.');
          patch.volume_cbm = volume;
          const frozenRate = unit === 'CBM' ? Number(existing.price_per_cbm) || 0 : unit === 'KG' ? Number(existing.price_per_kg) || 0 : 0;
          if (frozenRate > 0) {
            // Re-price with the tariff frozen on this parcel (kg or CBM), never the current tariff.
            const fx = Number(existing.pricing_exchange_rate) || 1;
            const freight = roundMoney((unit === 'CBM' ? volume : weight) * frozenRate);
            patch.freight_amount = freight;
            patch.transport_cost_usd = roundMoney(freight / fx);
            patch.total_amount = roundMoney(freight + extraUSD * fx);
          } else {
            const transportUSD = Number(patch.transport_cost_usd ?? existing.transport_cost_usd ?? 0);
            if (!Number.isFinite(transportUSD) || transportUSD < 0) throw new ApiError(400, 'Les frais de transport ne peuvent pas être négatifs.');
            patch.transport_cost_usd = roundMoney(transportUSD);
          }
          patch.weight_kg = weight;
          patch.extra_fees_usd = roundMoney(extraUSD);
          patch.total_cost_usd = roundMoney(Number(patch.transport_cost_usd) + extraUSD);
        }
      }
      const { data, error } = await db.from(table).update(patch).eq('id', resourceId).select('*').maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Enregistrement non trouvé.' }, 404);
      if (table === 'parcels') { await recalculateParcel(resourceId); }
      if (table === 'clients') await refreshClient(resourceId);
      await audit(actor!, 'UPDATE', table.toUpperCase(), resourceId, `Mise à jour ${table} ${resourceId}`);
      return json(fromRow(data));
    }

    if (method === 'DELETE' && resourceId) {
      if (table === 'users' && resourceId === actor!.id) return json({ error: 'Vous ne pouvez pas supprimer votre propre compte actif.' }, 400);
      if (table === 'employees') {
        const { count, error } = await db.from('salary_payments').select('*', { count: 'exact', head: true }).eq('employee_id', resourceId);
        if (error) throw error;
        if ((count || 0) > 0) return json({ error: 'Suppression impossible : cet employé possède un historique de paie. Désactivez plutôt son profil.' }, 400);
      }
      if (table === 'clients') {
        const { data: clientRow, error: clientRowError } = await db.from('clients').select('*').eq('id', resourceId).maybeSingle();
        if (clientRowError) throw clientRowError;
        if (!clientRow) return json({ error: 'Client non trouvé.' }, 404);
        const { data: clientParcels, error: parcelsError } = await db.from('parcels').select('*').eq('client_id', resourceId);
        if (parcelsError) throw parcelsError;
        const parcelIds = ((clientParcels || []) as any[]).map((p) => p.id);
        const { data: byClient, error: payError } = await db.from('payments').select('*').eq('client_id', resourceId);
        if (payError) throw payError;
        let byParcel: any[] = [];
        if (parcelIds.length > 0) {
          const { data, error: byParcelError } = await db.from('payments').select('*').in('parcel_id', parcelIds);
          if (byParcelError) throw byParcelError;
          byParcel = data || [];
        }
        const clientPayments = [...new Map([...(byClient || []), ...byParcel].map((p: any) => [p.id, p])).values()];
        const parcelCount = parcelIds.length, paymentCount = clientPayments.length;
        if (parcelCount + paymentCount > 0) {
          // Deleting a client's parcels and receipts must be an explicit admin choice.
          if (url.searchParams.get('withRecords') !== 'true') {
            return json({
              error: `Ce client possède ${parcelCount} colis et ${paymentCount} paiement(s). Cochez « Supprimer aussi ses colis et paiements » pour tout supprimer.`,
              parcelsCount: parcelCount,
              paymentsCount: paymentCount,
            }, 409);
          }
          const paidUSD = roundMoney(clientPayments.reduce((sum: number, p: any) => sum + Number(p.amount_usd || 0), 0));
          const { error } = await db.rpc('delete_client_cascade_transaction', {
            target_id: resourceId,
            audit_data: auditRow(actor!, 'DELETE', 'CLIENT', resourceId,
              `Suppression du client ${clientRow.full_name} (${clientRow.code}) avec ${parcelCount} colis (${((clientParcels || []) as any[]).map((p) => p.tracking_number).join(', ') || '—'}) et ${paymentCount} reçu(s) (${clientPayments.map((p: any) => p.receipt_number).join(', ') || '—'}) — total encaissé ${paidUSD} $`,
              { client: clientRow, parcels: clientParcels, payments: clientPayments }, null),
          });
          if (error) throw error;
          return json({ success: true, message: `Client ${clientRow.full_name} supprimé avec ${parcelCount} colis et ${paymentCount} paiement(s).` });
        }
      }
      if (table === 'parcels') {
        const { data: linkedPayments, error: linkedError } = await db.from('payments').select('id,receipt_number,original_amount,currency,amount_usd,client_id').eq('parcel_id', resourceId);
        if (linkedError) throw linkedError;
        const receipts = (linkedPayments || []) as any[];
        if (receipts.length > 0) {
          const totalUSD = roundMoney(receipts.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0));
          // Deleting cash receipts must be an explicit admin choice.
          if (url.searchParams.get('withPayments') !== 'true') {
            return json({
              error: `Ce colis possède ${receipts.length} paiement(s) enregistré(s) (${totalUSD} $). Cochez « Supprimer aussi les reçus » pour le supprimer avec ses paiements.`,
              paymentsCount: receipts.length,
              paymentsTotalUSD: totalUSD,
            }, 409);
          }
          const { data: parcelRow, error: parcelError } = await db.from('parcels').select('*').eq('id', resourceId).maybeSingle();
          if (parcelError) throw parcelError;
          if (!parcelRow) return json({ error: 'Colis non trouvé.' }, 404);
          const { error } = await db.rpc('delete_parcel_with_payments_transaction', {
            target_id: resourceId,
            audit_data: auditRow(actor!, 'DELETE', 'PARCEL', resourceId,
              `Suppression du colis ${parcelRow.tracking_number} avec ${receipts.length} reçu(s) : ${receipts.map((p) => `${p.receipt_number} (${p.original_amount} ${p.currency})`).join(', ')} — total ${totalUSD} $`,
              { parcel: parcelRow, payments: receipts }, null),
          });
          if (error) throw error;
          return json({ success: true, message: `Colis ${parcelRow.tracking_number} et ${receipts.length} reçu(s) supprimés.` });
        }
      }
      const { data: before } = await db.from(table).select('*').eq('id', resourceId).maybeSingle();
      if (!before) return json({ error: 'Enregistrement non trouvé.' }, 404);
      if (table === 'expenses' && before.category === 'salaire') {
        return json({ error: 'Cette dépense provient d’un bulletin de salaire : supprimez le bulletin dans « Salaires ».' }, 400);
      }
      if (table === 'payments') {
        const { error } = await db.rpc('delete_payment_transaction', { target_id: resourceId, audit_data: auditRow(actor!, 'DELETE', 'PAYMENT', resourceId, `Suppression du reçu ${before.receipt_number}`) });
        if (error) throw error;
        return json({ success: true, message: `Reçu ${before.receipt_number} supprimé.` });
      }
      if (table === 'shipments') {
        const { error } = await db.rpc('delete_shipment_transaction', { target_id: resourceId, audit_data: auditRow(actor!, 'DELETE', 'SHIPMENT', resourceId, `Suppression de l’expédition ${before.shipment_number}`) });
        if (error) throw error;
        return json({ success: true, message: `Expédition ${before.shipment_number} supprimée.` });
      }
      if (table === 'parcels') {
        const { error } = await db.rpc('delete_parcel_transaction', { target_id: resourceId, audit_data: auditRow(actor!, 'DELETE', 'PARCEL', resourceId, `Suppression du colis ${before.tracking_number}`) });
        if (error) throw error;
        return json({ success: true, message: `Colis ${before.tracking_number} supprimé.` });
      }
      if (table === 'salary_payments') {
        const { error } = await db.rpc('delete_salary_transaction', { target_id: resourceId, audit_data: auditRow(actor!, 'DELETE', 'SALARY', resourceId, `Suppression du bulletin ${before.slip_number}`) });
        if (error) throw error;
        return json({ success: true, message: `Bulletin ${before.slip_number} supprimé.` });
      }
      if (table === 'expenses') {
        const { error } = await db.rpc('delete_expense_transaction', { target_id: resourceId, audit_data: auditRow(actor!, 'DELETE', 'EXPENSE', resourceId, `Suppression de la dépense ${before.voucher_number}`) });
        if (error) throw error;
        return json({ success: true, message: `Dépense ${before.voucher_number} supprimée.` });
      }
      if (table === 'users' && before.auth_user_id) {
        const { error: authDeleteError } = await db.auth.admin.deleteUser(before.auth_user_id);
        if (authDeleteError) throw authDeleteError;
      }
      if (table === 'shipments') {
        const { error: unlinkError } = await db.from('parcels').update({ shipment_id: null, shipment_number: null }).eq('shipment_id', resourceId);
        if (unlinkError) throw unlinkError;
      }
      const { error } = await db.from(table).delete().eq('id', resourceId);
      if (error) throw error;
      if (table === 'payments') {
        if (before.parcel_id) await recalculateParcel(before.parcel_id);
        else if (before.client_id) await refreshClient(before.client_id);
      }
      await audit(actor!, 'DELETE', table.toUpperCase(), resourceId, `Suppression ${table} ${resourceId}`);
      return json({ success: true, message: 'Enregistrement supprimé.' });
    }

    return json({ error: 'Opération non implémentée dans la passerelle Edge.' }, 501);
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    console.error('[Edge API]', error);
    const code = (error as { code?: string } | null)?.code;
    const status = code && /^(23|22|PGRST2)/.test(code) ? 400 : 500;
    return json({ error: describeDbError(error) }, status);
  }
}

Deno.serve(async (request) => {
  const response = await handle(request);
  response.headers.set('Access-Control-Allow-Origin', allowOrigin(request.headers.get('Origin')));
  response.headers.append('Vary', 'Origin');
  return response;
});
