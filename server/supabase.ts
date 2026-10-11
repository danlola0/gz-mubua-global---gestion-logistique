import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { dbManager } from './db.ts';

dotenv.config();

let currentSupabaseUrl = process.env.SUPABASE_URL?.trim() || '';
let currentSupabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

export let supabase: SupabaseClient | null = null;

function initClient(url: string, key: string) {
  if (url && key) {
    try {
      supabase = createClient(url, key, {
        auth: {
          persistSession: false,
        },
      });
      console.log(`[Supabase] Client initialized with URL: ${url}`);
    } catch (err) {
      console.error('[Supabase] Initialization error:', err);
      supabase = null;
    }
  } else {
    supabase = null;
    console.log('[Supabase] Configuration absente. Renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans .env.');
  }
}

initClient(currentSupabaseUrl, currentSupabaseKey);

export const supabaseService = {
  isConfigured(): boolean {
    return !!(currentSupabaseUrl && currentSupabaseKey && supabase);
  },

  updateConfig(url: string, key: string) {
    currentSupabaseUrl = (url || '').trim();
    currentSupabaseKey = (key || '').trim();
    initClient(currentSupabaseUrl, currentSupabaseKey);
    return {
      success: !!supabase,
      url: currentSupabaseUrl,
      hasKey: !!currentSupabaseKey,
    };
  },

  getStatus() {
    return {
      isConfigured: this.isConfigured(),
      url: currentSupabaseUrl ? currentSupabaseUrl.replace(/^(https?:\/\/[^/]+).*$/, '$1') : null,
      hasKey: !!currentSupabaseKey,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      message: this.isConfigured()
        ? 'Configuration Supabase chargée. Testez la connexion pour vérifier les identifiants et les tables.'
        : 'Renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans le fichier .env du serveur.',
    };
  },

  async testConnection(): Promise<{ success: boolean; message: string; tablesStatus?: 'ready' | 'tables_missing' | 'error' }> {
    if (!supabase) {
      return {
        success: false,
        tablesStatus: 'error',
        message: 'Variables SUPABASE_URL ou SUPABASE_ANON_KEY manquantes dans l’environnement.',
      };
    }
    try {
      // Test querying exchange_rates table
      const { data, error } = await supabase.from('exchange_rates').select('*').limit(1);
      if (error) {
        const msg = error.message || '';
        // If error indicates table does not exist
        if (
          error.code === '42P01' ||
          error.code === 'PGRST204' ||
          error.code === 'PGRST200' ||
          msg.includes('relation') ||
          msg.includes('does not exist') ||
          msg.includes('Could not find')
        ) {
          return {
            success: true,
            tablesStatus: 'tables_missing',
            message: `Connexion à Supabase (${currentSupabaseUrl}) établie avec succès ! Vos identifiants sont validés. Les tables PostgreSQL n’ont pas encore été créées dans la base : veuillez copier et exécuter le script schema.sql dans l’éditeur SQL de Supabase.`,
          };
        }
        return {
          success: false,
          tablesStatus: 'error',
          message: `Réponse Supabase : ${error.message} (Code : ${error.code})`,
        };
      }
      return {
        success: true,
        tablesStatus: 'ready',
        message: '✓ Connexion à la base de données PostgreSQL Supabase réussie et toutes les tables sont opérationnelles !',
      };
    } catch (err: any) {
      return {
        success: false,
        tablesStatus: 'error',
        message: `Erreur lors de la tentative de connexion : ${err.message}`,
      };
    }
  },

  async syncLocalToSupabase(): Promise<{ success: boolean; syncedCounts: Record<string, number>; error?: string }> {
    if (!supabase) {
      throw new Error('Supabase n’est pas configuré. Veuillez renseigner SUPABASE_URL et SUPABASE_ANON_KEY.');
    }

    const localData = dbManager.getData();
    const counts: Record<string, number> = {};

    try {
      // 1. Sync Exchange Rates
      if (localData.exchangeRates) {
        await supabase.from('exchange_rates').upsert({
          id: 1,
          usd_rate: localData.exchangeRates.USD,
          cny_rate: localData.exchangeRates.CNY,
          cdf_rate: localData.exchangeRates.CDF,
          aoa_rate: localData.exchangeRates.AOA,
          last_updated: localData.exchangeRates.lastUpdated,
        });
        counts.exchangeRates = 1;
      }

      // 2. Sync Agencies
      if (localData.agencies.length > 0) {
        const rows = localData.agencies.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          country: a.country,
          city: a.city,
          address: a.address,
          phone: a.phone,
          email: a.email,
          type: a.type,
          manager_name: a.managerName,
        }));
        await supabase.from('agencies').upsert(rows);
        counts.agencies = rows.length;
      }

      // 3. Sync Clients
      if (localData.clients.length > 0) {
        const rows = localData.clients.map((c) => ({
          id: c.id,
          code: c.code,
          full_name: c.fullName,
          phone: c.phone,
          email: c.email,
          address: c.address,
          city: c.city,
          country: c.country,
          total_parcels: c.totalParcels,
          total_amount_usd: c.totalAmountUSD,
          total_paid_usd: c.totalPaidUSD,
          remaining_balance_usd: c.remainingBalanceUSD,
          created_at: c.createdAt,
          notes: c.notes,
        }));
        await supabase.from('clients').upsert(rows);
        counts.clients = rows.length;
      }

      // 4. Sync Parcels
      if (localData.parcels.length > 0) {
        const rows = localData.parcels.map((p) => ({
          id: p.id,
          tracking_number: p.trackingNumber,
          client_id: p.clientId,
          client_name: p.clientName,
          client_phone: p.clientPhone,
          description: p.description,
          quantity: p.quantity,
          weight_kg: p.weightKg,
          length_cm: p.lengthCm,
          width_cm: p.widthCm,
          height_cm: p.heightCm,
          volume_cbm: p.volumeCbm,
          photos: p.photos,
          supplier: p.supplier,
          purchase_info: p.purchaseInfo,
          china_reception_address: p.chinaReceptionAddress,
          china_agency_id: p.chinaAgencyId,
          china_agency_name: p.chinaAgencyName,
          shipment_id: p.shipmentId,
          shipment_number: p.shipmentNumber,
          transport_mode: p.transportMode,
          origin: p.origin,
          destination: p.destination,
          destination_agency_id: p.destinationAgencyId,
          destination_agency_name: p.destinationAgencyName,
          status: p.status,
          status_history: p.statusHistory,
          pricing_currency: p.pricingCurrency,
          transport_cost_usd: p.transportCostUSD,
          extra_fees_usd: p.extraFeesUSD,
          total_cost_usd: p.totalCostUSD,
          amount_paid_usd: p.amountPaidUSD,
          remaining_amount_usd: p.remainingAmountUSD,
          warehouse_location: p.warehouseLocation,
          delivery_driver_name: p.deliveryDriverName,
          delivery_driver_phone: p.deliveryDriverPhone,
          delivery_recipient: p.deliveryRecipient,
          comments: p.comments,
          created_at: p.createdAt,
          updated_at: p.updatedAt,
        }));
        await supabase.from('parcels').upsert(rows);
        counts.parcels = rows.length;
      }

      // 5. Sync Shipments
      if (localData.shipments.length > 0) {
        const rows = localData.shipments.map((s) => ({
          id: s.id,
          shipment_number: s.shipmentNumber,
          departure_agency_id: s.departureAgencyId,
          departure_agency_name: s.departureAgencyName,
          destination: s.destination,
          destination_agency_id: s.destinationAgencyId,
          destination_agency_name: s.destinationAgencyName,
          transport_mode: s.transportMode,
          carrier_name: s.carrierName,
          container_or_flight_number: s.containerOrFlightNumber,
          departure_date: s.departureDate || null,
          estimated_arrival_date: s.estimatedArrivalDate || null,
          actual_arrival_date: s.actualArrivalDate || null,
          parcel_count: s.parcelCount,
          total_weight_kg: s.totalWeightKg,
          total_volume_cbm: s.totalVolumeCbm,
          total_cost_usd: s.totalCostUSD,
          status: s.status,
          parcel_ids: s.parcelIds,
          comments: s.comments,
          created_at: s.createdAt,
          updated_at: s.updatedAt,
        }));
        await supabase.from('shipments').upsert(rows);
        counts.shipments = rows.length;
      }

      // 6. Sync Payments
      if (localData.payments.length > 0) {
        const rows = localData.payments.map((p) => ({
          id: p.id,
          receipt_number: p.receiptNumber,
          parcel_id: p.parcelId,
          parcel_tracking_number: p.parcelTrackingNumber,
          client_id: p.clientId,
          client_name: p.clientName,
          type: p.type,
          original_amount: p.originalAmount,
          currency: p.currency,
          exchange_rate: p.exchangeRate,
          amount_usd: p.amountUSD,
          payment_method: p.paymentMethod,
          reference: p.reference,
          date: p.date,
          time: p.time,
          agency_id: p.agencyId,
          agency_name: p.agencyName,
          cashier_id: p.cashierId,
          cashier_name: p.cashierName,
          notes: p.notes,
        }));
        await supabase.from('payments').upsert(rows);
        counts.payments = rows.length;
      }

      // 7. Sync Expenses
      if (localData.expenses.length > 0) {
        const rows = localData.expenses.map((e) => ({
          id: e.id,
          voucher_number: e.voucherNumber,
          category: e.category,
          category_label: e.categoryLabel,
          original_amount: e.originalAmount,
          currency: e.currency,
          exchange_rate: e.exchangeRate,
          amount_usd: e.amountUSD,
          agency_id: e.agencyId,
          agency_name: e.agencyName,
          country: e.country,
          beneficiary: e.beneficiary,
          date: e.date,
          time: e.time,
          recorded_by: e.recordedBy,
          description: e.description,
        }));
        await supabase.from('expenses').upsert(rows);
        counts.expenses = rows.length;
      }

      return {
        success: true,
        syncedCounts: counts,
      };
    } catch (err: any) {
      console.error('[Supabase Sync Error]', err);
      return {
        success: false,
        syncedCounts: counts,
        error: err.message,
      };
    }
  },

  async deleteParcel(id: string) {
    if (!supabase) return { success: false, error: 'Supabase non configuré' };
    const { error } = await supabase.from('parcels').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async deleteClient(id: string) {
    if (!supabase) return { success: false, error: 'Supabase non configuré' };
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async deleteShipment(id: string) {
    if (!supabase) return { success: false, error: 'Supabase non configuré' };
    const { error } = await supabase.from('shipments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async deletePayment(id: string) {
    if (!supabase) return { success: false, error: 'Supabase non configuré' };
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async deleteExpense(id: string) {
    if (!supabase) return { success: false, error: 'Supabase non configuré' };
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async deleteEmployee(id: string) {
    if (!supabase) return { success: false, error: 'Supabase non configuré' };
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async deleteSalaryPayment(id: string) {
    if (!supabase) return { success: false, error: 'Supabase non configuré' };
    const { error } = await supabase.from('salary_payments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async deleteUser(id: string) {
    if (!supabase) return { success: false, error: 'Supabase non configuré' };
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async upsertParcel(p: any) {
    if (!supabase) return;
    try {
      await supabase.from('parcels').upsert({
        id: p.id,
        tracking_number: p.trackingNumber,
        client_id: p.clientId,
        client_name: p.clientName,
        client_phone: p.clientPhone,
        description: p.description,
        quantity: p.quantity,
        weight_kg: p.weightKg,
        length_cm: p.lengthCm,
        width_cm: p.widthCm,
        height_cm: p.heightCm,
        volume_cbm: p.volumeCbm,
        photos: p.photos || [],
        supplier: p.supplier,
        purchase_info: p.purchaseInfo,
        china_reception_address: p.chinaReceptionAddress,
        china_agency_id: p.chinaAgencyId,
        china_agency_name: p.chinaAgencyName,
        shipment_id: p.shipmentId || null,
        shipment_number: p.shipmentNumber || null,
        transport_mode: p.transportMode,
        origin: p.origin,
        destination: p.destination,
        destination_agency_id: p.destinationAgencyId || null,
        destination_agency_name: p.destinationAgencyName,
        status: p.status,
        status_history: p.statusHistory || [],
        pricing_currency: p.pricingCurrency,
        transport_cost_usd: p.transportCostUSD,
        extra_fees_usd: p.extraFeesUSD,
        total_cost_usd: p.totalCostUSD,
        amount_paid_usd: p.amountPaidUSD,
        remaining_amount_usd: p.remainingAmountUSD,
        warehouse_location: p.warehouseLocation,
        delivery_driver_name: p.deliveryDriverName,
        delivery_driver_phone: p.deliveryDriverPhone,
        delivery_recipient: p.deliveryRecipient,
        comments: p.comments,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      });
    } catch (e) {
      console.error('[Supabase upsertParcel error]', e);
    }
  },

  async upsertShipment(s: any) {
    if (!supabase) throw new Error('Supabase non configuré');
    const { error } = await supabase.from('shipments').upsert({
        id: s.id,
        shipment_number: s.shipmentNumber,
        departure_agency_id: s.departureAgencyId,
        departure_agency_name: s.departureAgencyName,
        destination: s.destination,
        destination_agency_id: s.destinationAgencyId,
        destination_agency_name: s.destinationAgencyName,
        transport_mode: s.transportMode,
        carrier_name: s.carrierName,
        container_or_flight_number: s.containerOrFlightNumber,
        departure_date: s.departureDate || null,
        estimated_arrival_date: s.estimatedArrivalDate || null,
        actual_arrival_date: s.actualArrivalDate || null,
        parcel_count: s.parcelCount,
        total_weight_kg: s.totalWeightKg,
        total_volume_cbm: s.totalVolumeCbm,
        total_cost_usd: s.totalCostUSD,
        status: s.status,
        parcel_ids: s.parcelIds,
        comments: s.comments,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
    });
    if (error) throw new Error(`[Supabase upsertShipment error] ${error.message}`);
  },

  async upsertPayment(pay: any) {
    if (!supabase) return;
    try {
      await supabase.from('payments').upsert({
        id: pay.id,
        receipt_number: pay.receiptNumber,
        parcel_id: pay.parcelId,
        parcel_tracking_number: pay.parcelTrackingNumber,
        client_id: pay.clientId,
        client_name: pay.clientName,
        type: pay.type,
        original_amount: pay.originalAmount,
        currency: pay.currency,
        exchange_rate: pay.exchangeRate,
        amount_usd: pay.amountUSD,
        payment_method: pay.paymentMethod,
        reference: pay.reference,
        date: pay.date,
        time: pay.time,
        agency_id: pay.agencyId,
        agency_name: pay.agencyName,
        cashier_id: pay.cashierId,
        cashier_name: pay.cashierName,
        notes: pay.notes,
      });
    } catch (e) {
      console.error('[Supabase upsertPayment error]', e);
    }
  },

  async upsertClient(c: any) {
    if (!supabase) return;
    try {
      await supabase.from('clients').upsert({
        id: c.id,
        code: c.code,
        full_name: c.fullName,
        phone: c.phone,
        email: c.email,
        address: c.address,
        city: c.city,
        country: c.country,
        total_parcels: c.totalParcels,
        total_amount_usd: c.totalAmountUSD,
        total_paid_usd: c.totalPaidUSD,
        remaining_balance_usd: c.remainingBalanceUSD,
        created_at: c.createdAt,
        notes: c.notes,
      });
    } catch (e) {
      console.error('[Supabase upsertClient error]', e);
    }
  },

  async upsertExpense(exp: any) {
    if (!supabase) return;
    try {
      await supabase.from('expenses').upsert({
        id: exp.id,
        voucher_number: exp.voucherNumber,
        category: exp.category,
        category_label: exp.categoryLabel,
        original_amount: exp.originalAmount,
        currency: exp.currency,
        exchange_rate: exp.exchangeRate,
        amount_usd: exp.amountUSD,
        agency_id: exp.agencyId,
        agency_name: exp.agencyName,
        country: exp.country,
        beneficiary: exp.beneficiary,
        date: exp.date,
        time: exp.time,
        recorded_by: exp.recordedBy,
        description: exp.description,
      });
    } catch (e) {
      console.error('[Supabase upsertExpense error]', e);
    }
  },

  async upsertEmployee(emp: any) {
    if (!supabase) return;
    try {
      await supabase.from('employees').upsert({
        id: emp.id,
        employee_code: emp.employeeCode,
        full_name: emp.fullName,
        phone: emp.phone,
        job_title: emp.jobTitle,
        agency_id: emp.agencyId,
        agency_name: emp.agencyName,
        country: emp.country,
        base_salary_usd: emp.baseSalaryUSD,
        preferred_currency: emp.preferredCurrency,
        status: emp.status || 'actif',
        hire_date: emp.hireDate,
      });
    } catch (e) {
      console.error('[Supabase upsertEmployee error]', e);
    }
  },

  async upsertSalaryPayment(sp: any) {
    if (!supabase) return;
    try {
      await supabase.from('salary_payments').upsert({
        id: sp.id,
        slip_number: sp.slipNumber,
        employee_id: sp.employeeId,
        employee_name: sp.employeeName,
        job_title: sp.jobTitle,
        agency_name: sp.agencyName,
        country: sp.country,
        period_month: sp.periodMonth,
        base_salary_usd: sp.baseSalaryUSD,
        primes_usd: sp.primesUSD,
        avances_usd: sp.avancesUSD,
        retenues_usd: sp.retenuesUSD,
        overtime_usd: sp.overtimeUSD,
        net_salary_usd: sp.netSalaryUSD,
        paid_amount_original: sp.paidAmountOriginal,
        currency: sp.currency,
        exchange_rate: sp.exchangeRate,
        payment_date: sp.paymentDate,
        status: sp.status,
        payment_method: sp.paymentMethod,
        notes: sp.notes,
      });
    } catch (e) {
      console.error('[Supabase upsertSalaryPayment error]', e);
    }
  },

  async upsertUser(u: any) {
    if (!supabase) return;
    try {
      await supabase.from('users').upsert({
        id: u.id,
        username: u.username,
        full_name: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        agency_id: u.agencyId,
        agency_name: u.agencyName,
        status: u.status || 'active',
      });
    } catch (e) {
      console.error('[Supabase upsertUser error]', e);
    }
  },

  async upsertExchangeRates(rates: any) {
    if (!supabase) return;
    try {
      await supabase.from('exchange_rates').upsert({
        id: 1,
        usd_rate: rates.USD,
        cny_rate: rates.CNY,
        cdf_rate: rates.CDF,
        aoa_rate: rates.AOA,
        last_updated: rates.lastUpdated || new Date().toISOString().split('T')[0],
      });
    } catch (e) {
      console.error('[Supabase upsertExchangeRates error]', e);
    }
  },

  async upsertAuditLog(log: any) {
    if (!supabase) return;
    try {
      const safeJson = (val: any) => {
        if (!val) return null;
        if (typeof val === 'object') return val;
        try {
          return JSON.parse(val);
        } catch {
          return { val };
        }
      };

      await supabase.from('audit_logs').upsert({
        id: log.id,
        timestamp: log.timestamp && log.timestamp.includes('T') ? log.timestamp : new Date().toISOString(),
        user_id: log.userId,
        user_name: log.userName,
        user_role: log.userRole,
        agency_name: log.agencyName,
        action: log.action,
        entity_type: log.entityType,
        entity_id: log.entityId,
        details: log.details,
        old_value: safeJson(log.oldValue),
        new_value: safeJson(log.newValue),
      });
    } catch (e) {
      console.error('[Supabase upsertAuditLog error]', e);
    }
  },

  async upsertNotification(notif: any) {
    if (!supabase) return;
    try {
      await supabase.from('notifications').upsert({
        id: notif.id,
        timestamp: new Date().toISOString(),
        type: notif.type,
        title: notif.title,
        message: notif.message,
        target_role: notif.targetRole,
        parcel_tracking: notif.parcelTracking,
        is_read: notif.isRead,
      });
    } catch (e) {
      console.error('[Supabase upsertNotification error]', e);
    }
  },

  async getTableCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    if (!supabase) return counts;
    const tables = [
      'parcels',
      'clients',
      'shipments',
      'payments',
      'expenses',
      'employees',
      'salary_payments',
      'users',
      'agencies',
      'exchange_rates',
      'audit_logs',
      'notifications',
    ];
    for (const t of tables) {
      try {
        const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
        counts[t] = error ? 0 : count || 0;
      } catch {
        counts[t] = 0;
      }
    }
    return counts;
  },

  async fetchFromSupabase() {
    if (!supabase) return null;
    try {
      const [
        { data: rawRates, error: ratesError },
        { data: rawAgencies, error: agenciesError },
        { data: rawUsers, error: usersError },
        { data: rawClients, error: clientsError },
        { data: rawParcels, error: parcelsError },
        { data: rawShipments, error: shipmentsError },
        { data: rawPayments, error: paymentsError },
        { data: rawExpenses, error: expensesError },
        { data: rawEmployees, error: employeesError },
        { data: rawSalaries, error: salariesError },
        { data: rawLogs, error: logsError },
        { data: rawNotifs, error: notifsError },
      ] = await Promise.all([
        supabase.from('exchange_rates').select('*').limit(1),
        supabase.from('agencies').select('*').order('name'),
        supabase.from('users').select('*').order('created_at'),
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('parcels').select('*').order('created_at', { ascending: false }),
        supabase.from('shipments').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('employees').select('*').order('hire_date'),
        supabase.from('salary_payments').select('*').order('payment_date', { ascending: false }),
        supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200),
        supabase.from('notifications').select('*').order('timestamp', { ascending: false }).limit(100),
      ]);

      const queryError = ratesError || agenciesError || usersError || clientsError || parcelsError ||
        shipmentsError || paymentsError || expensesError || employeesError || salariesError || logsError || notifsError;
      if (queryError) {
        throw new Error(`Erreur de lecture Supabase : ${queryError.message}`);
      }

      const exchangeRates = rawRates && rawRates.length > 0 ? {
        USD: Number(rawRates[0].usd_rate) || 1,
        CNY: Number(rawRates[0].cny_rate) || 7.25,
        CDF: Number(rawRates[0].cdf_rate) || 2850,
        AOA: Number(rawRates[0].aoa_rate) || 920,
        lastUpdated: rawRates[0].last_updated || new Date().toISOString().split('T')[0],
      } : undefined;

      const agencies = (rawAgencies || []).map((a: any) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        country: a.country,
        city: a.city,
        address: a.address,
        phone: a.phone,
        email: a.email,
        type: a.type,
        managerName: a.manager_name,
      }));

      const users = (rawUsers || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        agencyId: u.agency_id,
        agencyName: u.agency_name,
        status: u.status,
        createdAt: u.created_at ? u.created_at.split('T')[0] : '',
      }));

      const clients = (rawClients || []).map((c: any) => ({
        id: c.id,
        code: c.code,
        fullName: c.full_name,
        phone: c.phone,
        email: c.email || '',
        address: c.address || '',
        city: c.city || 'Kinshasa',
        country: c.country || 'RDC',
        totalParcels: Number(c.total_parcels) || 0,
        totalAmountUSD: Number(c.total_amount_usd) || 0,
        totalPaidUSD: Number(c.total_paid_usd) || 0,
        remainingBalanceUSD: Number(c.remaining_balance_usd) || 0,
        createdAt: c.created_at ? c.created_at.split('T')[0] : '',
        notes: c.notes || '',
      }));

      const parcels = (rawParcels || []).map((p: any) => ({
        id: p.id,
        trackingNumber: p.tracking_number,
        clientId: p.client_id,
        clientName: p.client_name,
        clientPhone: p.client_phone,
        description: p.description,
        quantity: Number(p.quantity) || 1,
        weightKg: Number(p.weight_kg) || 0,
        lengthCm: Number(p.length_cm) || 0,
        widthCm: Number(p.width_cm) || 0,
        heightCm: Number(p.height_cm) || 0,
        volumeCbm: Number(p.volume_cbm) || 0,
        photos: Array.isArray(p.photos) ? p.photos : [],
        supplier: p.supplier || '',
        purchaseInfo: p.purchase_info || '',
        chinaReceptionAddress: p.china_reception_address || '',
        chinaReceptionDate: p.china_reception_date || '',
        chinaAgencyId: p.china_agency_id || 'AG-GZ',
        chinaAgencyName: p.china_agency_name || 'GZ MUBUA Hub Guangzhou',
        shipmentId: p.shipment_id || undefined,
        shipmentNumber: p.shipment_number || undefined,
        transportMode: p.transport_mode || 'MARITIME',
        origin: p.origin || 'Guangzhou, Chine',
        destination: p.destination || 'Kinshasa',
        destinationAgencyId: p.destination_agency_id || 'AG-LIMETE',
        destinationAgencyName: p.destination_agency_name || 'Dépôt & Retrait Kinshasa Limete',
        status: p.status,
        statusHistory: Array.isArray(p.status_history) ? p.status_history : [],
        pricingCurrency: p.pricing_currency || 'USD',
        transportCostUSD: Number(p.transport_cost_usd) || 0,
        extraFeesUSD: Number(p.extra_fees_usd) || 0,
        totalCostUSD: Number(p.total_cost_usd) || 0,
        amountPaidUSD: Number(p.amount_paid_usd) || 0,
        remainingAmountUSD: Number(p.remaining_amount_usd) || 0,
        warehouseLocation: p.warehouse_location || '',
        deliveryDriverName: p.delivery_driver_name || '',
        deliveryDriverPhone: p.delivery_driver_phone || '',
        deliveryRecipient: p.delivery_recipient || '',
        deliveryDate: p.delivery_date || '',
        comments: p.comments || '',
        createdAt: p.created_at ? p.created_at.split('T')[0] : '',
        updatedAt: p.updated_at ? p.updated_at.split('T')[0] : '',
      }));

      const shipments = (rawShipments || []).map((s: any) => ({
        id: s.id,
        shipmentNumber: s.shipment_number,
        departureAgencyId: s.departure_agency_id || 'AG-GZ',
        departureAgencyName: s.departure_agency_name || 'GZ MUBUA Hub Guangzhou',
        destination: s.destination || 'Kinshasa',
        destinationAgencyId: s.destination_agency_id || 'AG-LIMETE',
        destinationAgencyName: s.destination_agency_name || 'Dépôt & Retrait Kinshasa Limete',
        transportMode: s.transport_mode || 'MARITIME',
        carrierName: s.carrier_name || '',
        containerOrFlightNumber: s.container_or_flight_number || '',
        departureDate: s.departure_date || '',
        estimatedArrivalDate: s.estimated_arrival_date || '',
        actualArrivalDate: s.actual_arrival_date || '',
        parcelCount: Number(s.parcel_count) || 0,
        totalWeightKg: Number(s.total_weight_kg) || 0,
        totalVolumeCbm: Number(s.total_volume_cbm) || 0,
        totalCostUSD: Number(s.total_cost_usd) || 0,
        status: s.status,
        parcelIds: Array.isArray(s.parcel_ids) ? s.parcel_ids : [],
        comments: s.comments || '',
        createdAt: s.created_at ? s.created_at.split('T')[0] : '',
        updatedAt: s.updated_at ? s.updated_at.split('T')[0] : '',
      }));

      const payments = (rawPayments || []).map((pay: any) => ({
        id: pay.id,
        receiptNumber: pay.receipt_number,
        parcelId: pay.parcel_id || undefined,
        parcelTrackingNumber: pay.parcel_tracking_number || undefined,
        clientId: pay.client_id,
        clientName: pay.client_name,
        type: pay.type,
        originalAmount: Number(pay.original_amount) || 0,
        currency: pay.currency,
        exchangeRate: Number(pay.exchange_rate) || 1,
        amountUSD: Number(pay.amount_usd) || 0,
        paymentMethod: pay.payment_method || 'ESPECES',
        reference: pay.reference || '',
        date: pay.date,
        time: pay.time || '',
        agencyId: pay.agency_id || 'AG-GOMBE',
        agencyName: pay.agency_name || 'Siège Kinshasa Gombe',
        cashierId: pay.cashier_id || '',
        cashierName: pay.cashier_name || '',
        notes: pay.notes || '',
      }));

      const expenses = (rawExpenses || []).map((exp: any) => ({
        id: exp.id,
        voucherNumber: exp.voucher_number,
        category: exp.category,
        categoryLabel: exp.category_label || exp.category,
        originalAmount: Number(exp.original_amount) || 0,
        currency: exp.currency,
        exchangeRate: Number(exp.exchange_rate) || 1,
        amountUSD: Number(exp.amount_usd) || 0,
        agencyId: exp.agency_id || 'AG-GOMBE',
        agencyName: exp.agency_name || 'Siège Kinshasa Gombe',
        country: exp.country || 'RDC',
        beneficiary: exp.beneficiary,
        date: exp.date,
        time: exp.time || '',
        recordedBy: exp.recorded_by || '',
        description: exp.description || '',
        attachmentName: exp.attachment_name,
        attachmentUrl: exp.attachment_url,
      }));

      const employees = (rawEmployees || []).map((e: any) => ({
        id: e.id,
        employeeCode: e.employee_code,
        fullName: e.full_name,
        phone: e.phone,
        jobTitle: e.job_title,
        agencyId: e.agency_id,
        agencyName: e.agency_name,
        country: e.country,
        baseSalaryUSD: Number(e.base_salary_usd) || 0,
        preferredCurrency: e.preferred_currency || 'USD',
        status: e.status || 'actif',
        hireDate: e.hire_date || '',
      }));

      const salaryPayments = (rawSalaries || []).map((s: any) => ({
        id: s.id,
        slipNumber: s.slip_number,
        employeeId: s.employee_id,
        employeeName: s.employee_name,
        jobTitle: s.job_title || '',
        agencyName: s.agency_name || '',
        country: s.country || '',
        periodMonth: s.period_month,
        baseSalaryUSD: Number(s.base_salary_usd) || 0,
        primesUSD: Number(s.primes_usd) || 0,
        avancesUSD: Number(s.avances_usd) || 0,
        retenuesUSD: Number(s.retenues_usd) || 0,
        overtimeUSD: Number(s.overtime_usd) || 0,
        netSalaryUSD: Number(s.net_salary_usd) || 0,
        paidAmountOriginal: Number(s.paid_amount_original) || 0,
        currency: s.currency,
        exchangeRate: Number(s.exchange_rate) || 1,
        paymentDate: s.payment_date,
        status: s.status,
        paymentMethod: s.payment_method || '',
        notes: s.notes || '',
      }));

      const auditLogs = (rawLogs || []).map((l: any) => ({
        id: l.id,
        timestamp: l.timestamp,
        userId: l.user_id,
        userName: l.user_name,
        userRole: l.user_role,
        agencyName: l.agency_name,
        action: l.action,
        entityType: l.entity_type,
        entityId: l.entity_id,
        details: l.details,
        oldValue: l.old_value,
        newValue: l.new_value,
      }));

      const notifications = (rawNotifs || []).map((n: any) => ({
        id: n.id,
        timestamp: n.timestamp,
        type: n.type,
        title: n.title,
        message: n.message,
        targetRole: n.target_role,
        parcelTracking: n.parcel_tracking,
        isRead: n.is_read,
      }));

      return {
        exchangeRates,
        agencies,
        users,
        clients,
        parcels,
        shipments,
        payments,
        expenses,
        employees,
        salaryPayments,
        auditLogs,
        notifications,
      };
    } catch (err) {
      console.error('[Supabase fetchFromSupabase error]', err);
      return null;
    }
  },
};
