import type {
  User,
  Agency,
  Client,
  Parcel,
  Shipment,
  Payment,
  Expense,
  Employee,
  SalaryPayment,
  ExchangeRates,
  AuditLogItem,
  NotificationItem,
  DashboardStats,
  ParcelStatus,
  Currency,
} from '../types/index.ts';
import { supabaseClient } from './supabaseClient.ts';
import { PARCEL_STATUSES } from '../types/index.ts';

// Address sent to clients: always the public site, even when an agent works
// from a local or preview copy of the app.
export const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || 'https://gzmubuaglobal.web.app').replace(/\/$/, '');

/** Public link that opens the tracking page with this number already searched (no account needed). */
export function publicTrackingUrl(trackingNumber: string): string {
  return `${PUBLIC_APP_URL}/?suivi=${encodeURIComponent(trackingNumber)}`;
}

const supabaseFunctionUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ||
  `${(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1/api`;
const BASE_URL = supabaseFunctionUrl;
const nativeFetch = globalThis.fetch.bind(globalThis);

// The browser uses only the public anon key and the current Supabase Auth JWT.
const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers);
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (anonKey) headers.set('apikey', anonKey);
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session?.access_token) {
      headers.set('Authorization', `Bearer ${data.session.access_token}`);
    }
  }
  let response: Response;
  try {
    response = await nativeFetch(input, { ...init, headers });
  } catch {
    // Network failure or CORS refusal: the browser only reports "Failed to fetch".
    throw new Error(
      `Impossible de joindre l’API Supabase depuis ${window.location.origin}. Vérifiez votre connexion internet ; si elle fonctionne, cette adresse n’est pas autorisée par l’API (APP_ORIGIN).`
    );
  }
  if (!response.ok) {
    const errorBody = await response.clone().json().catch(() => ({}));
    throw new Error(errorBody.error || `La requête Supabase a échoué (${response.status}).`);
  }
  return response;
};

export const api = {
  // Auth
  async login(username: string, password?: string): Promise<{ success: boolean; user: User }> {
    if (!supabaseClient || !password) {
      throw new Error('Connexion Supabase Auth indisponible ou mot de passe manquant.');
    }
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: username,
      password,
    });
    if (error) throw error;
    const { data: profile, error: profileError } = await supabaseClient.rpc('get_my_app_profile');
    if (profileError) throw profileError;
    const row = Array.isArray(profile) ? profile[0] : profile;
    if (!row) throw new Error('Aucun profil métier associé à ce compte Auth.');
    const user: User = { id: row.id, username: row.username, fullName: row.full_name, email: row.email || '', phone: row.phone || '', role: row.role, agencyId: row.agency_id || '', agencyName: row.agency_name || '', status: row.status, createdAt: String(row.created_at || '').split('T')[0] };
    return { success: true, user };
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch(`${BASE_URL}/users`);
    return res.json();
  },

  async createUser(userData: Partial<User>): Promise<User> {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return res.json();
  },

  // Agencies
  async getAgencies(): Promise<Agency[]> {
    const res = await fetch(`${BASE_URL}/agencies`);
    return res.json();
  },

  /** Links the signed-in (e-mail verified) account to the client file created by an agent. */
  async linkClientAccount(data: { phone: string; activationCode?: string }): Promise<void> {
    await fetch(`${BASE_URL}/client-accounts/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  /** Issues a one-time activation code (valid 7 days) for a client to create an account. */
  async createClientActivationCode(clientId: string): Promise<{ code: string; expiresAt: string }> {
    const res = await fetch(`${BASE_URL}/clients/${clientId}/activation-code`, { method: 'POST' });
    return res.json();
  },

  async createAgency(data: Partial<Agency>): Promise<Agency> {
    const res = await fetch(`${BASE_URL}/agencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Exchange rates
  async getExchangeRates(): Promise<ExchangeRates> {
    const res = await fetch(`${BASE_URL}/exchange-rates`);
    return res.json();
  },

  async updateExchangeRates(rates: Partial<ExchangeRates>): Promise<ExchangeRates> {
    const res = await fetch(`${BASE_URL}/exchange-rates`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rates),
    });
    return res.json();
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${BASE_URL}/stats`);
    return res.json();
  },

  // Audit logs
  async getAuditLogs(): Promise<AuditLogItem[]> {
    const res = await fetch(`${BASE_URL}/audit-logs`);
    return res.json();
  },

  // Notifications
  async getNotifications(): Promise<NotificationItem[]> {
    const res = await fetch(`${BASE_URL}/notifications`);
    return res.json();
  },

  async markNotificationRead(id: string | 'all'): Promise<void> {
    await fetch(`${BASE_URL}/notifications/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  },

  // Clients
  async getClients(): Promise<Client[]> {
    const res = await fetch(`${BASE_URL}/clients`);
    return res.json();
  },

  async createClient(data: Partial<Client> & { userId?: string; userName?: string; userRole?: string }): Promise<Client> {
    const res = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateClient(id: string, data: Partial<Client>): Promise<Client> {
    const res = await fetch(`${BASE_URL}/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteClient(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/clients/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression');
    }
    return res.json();
  },

  // Parcels
  async getParcels(): Promise<Parcel[]> {
    const res = await fetch(`${BASE_URL}/parcels`);
    return res.json();
  },

  async createParcel(data: any): Promise<Parcel> {
    const res = await fetch(`${BASE_URL}/parcels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  /** Uploads one compressed photo (data URL) to Supabase Storage; returns its public URL. */
  async uploadParcelPhoto(dataUrl: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/uploads/parcel-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    });
    const { url } = await res.json();
    return url;
  },

  async updateParcelStatus(
    id: string,
    params: {
      status: ParcelStatus;
      comment?: string;
      userName: string;
      userId: string;
      userRole: string;
      agencyName?: string;
      warehouseLocation?: string;
      deliveryDriverName?: string;
      deliveryDriverPhone?: string;
      deliveryRecipient?: string;
    }
  ): Promise<Parcel> {
    const res = await fetch(`${BASE_URL}/parcels/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async updateParcel(id: string, data: Partial<Parcel>): Promise<Parcel> {
    const res = await fetch(`${BASE_URL}/parcels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteParcel(id: string, withPayments = false): Promise<{ success: boolean; message: string }> {
    const query = withPayments ? '?withPayments=true' : '';
    const res = await fetch(`${BASE_URL}/parcels/${id}${query}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression');
    }
    return res.json();
  },

  // Public Tracking
  async trackParcel(trackingNumber: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/track/${encodeURIComponent(trackingNumber)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Colis introuvable');
    }
    return res.json();
  },

  // Shipments
  async getShipments(): Promise<Shipment[]> {
    const res = await fetch(`${BASE_URL}/shipments`);
    return res.json();
  },

  async createShipment(data: any): Promise<Shipment> {
    const res = await fetch(`${BASE_URL}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Échec de création de l’expédition');
    }
    return res.json();
  },

  async addParcelsToShipment(
    shipmentId: string,
    parcelIds: string[],
    userMeta: { userName: string; userId: string; userRole: string }
  ): Promise<Shipment> {
    const res = await fetch(`${BASE_URL}/shipments/${shipmentId}/parcels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcelIds, ...userMeta }),
    });
    return res.json();
  },

  async markShipmentDeparted(
    shipmentId: string,
    params: { departureDate?: string; userName: string; userId: string; userRole: string }
  ): Promise<Shipment> {
    const res = await fetch(`${BASE_URL}/shipments/${shipmentId}/depart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async markShipmentArrived(
    shipmentId: string,
    params: { actualArrivalDate?: string; userName: string; userId: string; userRole: string; agencyName?: string }
  ): Promise<Shipment> {
    const res = await fetch(`${BASE_URL}/shipments/${shipmentId}/arrive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async updateShipment(id: string, data: Partial<Shipment>): Promise<Shipment> {
    const res = await fetch(`${BASE_URL}/shipments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteShipment(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/shipments/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression');
    }
    return res.json();
  },

  // Payments / Recettes
  async getPayments(): Promise<Payment[]> {
    const res = await fetch(`${BASE_URL}/payments`);
    return res.json();
  },

  async createPayment(data: any): Promise<Payment> {
    const res = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deletePayment(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/payments/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression');
    }
    return res.json();
  },

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    const res = await fetch(`${BASE_URL}/expenses`);
    return res.json();
  },

  async createExpense(data: any): Promise<Expense> {
    const res = await fetch(`${BASE_URL}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateExpense(id: string, data: Partial<Expense>): Promise<Expense> {
    const res = await fetch(`${BASE_URL}/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteExpense(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression');
    }
    return res.json();
  },

  // Employees & Salaries
  async getEmployees(): Promise<Employee[]> {
    const res = await fetch(`${BASE_URL}/employees`);
    return res.json();
  },

  async createEmployee(data: Partial<Employee>): Promise<Employee> {
    const res = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateEmployee(id: string, data: Partial<Employee>): Promise<Employee> {
    const res = await fetch(`${BASE_URL}/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteEmployee(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/employees/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression');
    }
    return res.json();
  },

  async getSalaries(): Promise<SalaryPayment[]> {
    const res = await fetch(`${BASE_URL}/salaries`);
    return res.json();
  },

  async createSalaryPayment(data: any): Promise<SalaryPayment> {
    const res = await fetch(`${BASE_URL}/salaries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteSalaryPayment(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/salaries/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression');
    }
    return res.json();
  },

  // User management
  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const res = await fetch(`${BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression');
    }
    return res.json();
  },

  // Supabase Integration
  async getSupabaseStatus(): Promise<{ isConfigured: boolean; url: string | null; message: string }> {
    const res = await fetch(`${BASE_URL}/supabase/status`);
    return res.json();
  },

  async getSupabaseCounts(): Promise<Record<string, number>> {
    const res = await fetch(`${BASE_URL}/supabase/counts`);
    return res.json();
  },

  async pullFromSupabase(): Promise<{ success: boolean; message: string; counts: Record<string, number> }> {
    const res = await fetch(`${BASE_URL}/supabase/pull`, { method: 'POST' });
    return res.json();
  },

  async updateSupabaseConfig(url: string, key: string): Promise<{ success: boolean; url: string; hasKey: boolean; error?: string }> {
    const res = await fetch(`${BASE_URL}/supabase/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key }),
    });
    return res.json();
  },

  async testSupabase(): Promise<{ success: boolean; message: string; tablesStatus?: 'ready' | 'tables_missing' | 'error' }> {
    const res = await fetch(`${BASE_URL}/supabase/test`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Échec du test de connexion Supabase');
    }
    return res.json();
  },

  async getSupabaseSchema(): Promise<{ sql: string }> {
    const res = await fetch(`${BASE_URL}/supabase/schema`);
    return res.json();
  },

  async syncToSupabase(): Promise<{ success: boolean; syncedCounts: Record<string, number>; error?: string }> {
    const res = await fetch(`${BASE_URL}/supabase/sync`, { method: 'POST' });
    return res.json();
  },
};

// Formatting helpers
export function formatUSD(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00 $';
  return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

/** "2026-10-12" (or an ISO timestamp) -> "12/10/2026"; returns the input if it is not a date. */
export function formatDay(value?: string): string {
  if (!value) return '';
  const day = String(value).slice(0, 10);
  const [y, m, d] = day.split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(value);
}

export function formatCurrency(amount: number, currency: Currency): string {
  if (currency === 'USD') return formatUSD(amount);
  if (currency === 'CNY') return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ¥`;
  if (currency === 'CDF') return `${amount.toLocaleString('fr-FR')} FC`;
  if (currency === 'AOA') return `${amount.toLocaleString('fr-FR')} Kz`;
  return `${amount} ${currency}`;
}

export function createWhatsAppTrackingLink(parcel: Parcel): string {
  const phone = (parcel.clientPhone || '').replace(/[^0-9]/g, '');
  const statusLabel = PARCEL_STATUSES[parcel.status]?.label || parcel.status;
  const volume = Number(parcel.volumeCbm) > 0 ? ` | Volume : ${parcel.volumeCbm} m³` : '';
  const text = encodeURIComponent(
    `Bonjour ${parcel.clientName},\n\nVoici le suivi de votre colis GZ MUBUA GLOBAL :\n` +
      `📦 N° de suivi : ${parcel.trackingNumber}\n` +
      `📌 Destination : ${parcel.destinationAgencyName || parcel.destination}\n` +
      `🚀 Statut actuel : ${statusLabel}\n` +
      `⚖️ Poids : ${parcel.weightKg} kg${volume}\n` +
      `💰 Solde restant : ${formatUSD(parcel.remainingAmountUSD)}\n\n` +
      `🔎 Suivez votre colis à tout moment (sans compte) :\n${publicTrackingUrl(parcel.trackingNumber)}\n\n` +
      `Merci pour votre confiance avec GZ MUBUA GLOBAL (Chine - Kinshasa - Angola) !`
  );
  return `https://wa.me/${phone}?text=${text}`;
}
