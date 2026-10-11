import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
  ParcelStatus,
  DashboardStats,
} from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');

export interface DatabaseSchema {
  users: User[];
  agencies: Agency[];
  clients: Client[];
  parcels: Parcel[];
  shipments: Shipment[];
  payments: Payment[];
  expenses: Expense[];
  employees: Employee[];
  salaryPayments: SalaryPayment[];
  exchangeRates: ExchangeRates;
  auditLogs: AuditLogItem[];
  notifications: NotificationItem[];
}

function getInitialData(): DatabaseSchema {
  return {
    users: [],
    agencies: [],
    clients: [],
    parcels: [],
    shipments: [],
    payments: [],
    expenses: [],
    employees: [],
    salaryPayments: [],
    exchangeRates: {
      USD: 1,
      CNY: 7.25,
      CDF: 2850,
      AOA: 920,
      lastUpdated: new Date().toISOString().split('T')[0],
    },
    auditLogs: [],
    notifications: [],
  };
}

class DatabaseManager {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
      } catch (err) {
        console.error('Error reading database file, creating fresh initial database:', err);
        this.data = getInitialData();
        this.persist();
      }
    } else {
      this.data = getInitialData();
      this.persist();
    }
  }

  private persist() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error persisting database:', err);
    }
  }

  // --- Recalculation helpers ---
  public recalculateClient(clientId: string) {
    const client = this.data.clients.find((c) => c.id === clientId);
    if (!client) return;

    const clientParcels = this.data.parcels.filter((p) => p.clientId === clientId);
    client.totalParcels = clientParcels.length;
    client.totalAmountUSD = clientParcels.reduce((sum, p) => sum + (p.totalCostUSD || 0), 0);

    const clientPayments = this.data.payments.filter((pay) => pay.clientId === clientId);
    client.totalPaidUSD = clientPayments.reduce((sum, pay) => sum + (pay.amountUSD || 0), 0);
    client.remainingBalanceUSD = Math.max(0, client.totalAmountUSD - client.totalPaidUSD);
  }

  public recalculateParcel(parcelId: string) {
    const parcel = this.data.parcels.find((p) => p.id === parcelId);
    if (!parcel) return;

    parcel.totalCostUSD = (parcel.transportCostUSD || 0) + (parcel.extraFeesUSD || 0);

    const parcelPayments = this.data.payments.filter((pay) => pay.parcelId === parcelId);
    parcel.amountPaidUSD = parcelPayments.reduce((sum, pay) => sum + (pay.amountUSD || 0), 0);
    parcel.remainingAmountUSD = Math.max(0, parcel.totalCostUSD - parcel.amountPaidUSD);

    this.recalculateClient(parcel.clientId);
  }

  public recalculateShipment(shipmentId: string) {
    const shipment = this.data.shipments.find((s) => s.id === shipmentId);
    if (!shipment) return;

    const linkedParcels = this.data.parcels.filter((p) => p.shipmentId === shipmentId);
    shipment.parcelIds = linkedParcels.map((p) => p.id);
    shipment.parcelCount = linkedParcels.length;
    shipment.totalWeightKg = linkedParcels.reduce((sum, p) => sum + (p.weightKg || 0), 0);
    shipment.totalVolumeCbm = Number(
      linkedParcels.reduce((sum, p) => sum + (p.volumeCbm || 0), 0).toFixed(3)
    );
  }

  // --- Audit & Log helper ---
  public addAuditLog(
    user: { id: string; name: string; role: any; agencyName?: string },
    action: AuditLogItem['action'],
    entityType: AuditLogItem['entityType'],
    entityId: string,
    details: string,
    oldValue?: any,
    newValue?: any
  ) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const log: AuditLogItem = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: `${dateStr} ${timeStr}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      agencyName: user.agencyName,
      action,
      entityType,
      entityId,
      details,
      oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
      newValue: newValue ? JSON.stringify(newValue) : undefined,
    };
    this.data.auditLogs.unshift(log);
    // keep max 500 audit logs
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
  }

  public addNotification(
    type: NotificationItem['type'],
    title: string,
    message: string,
    targetRole: any = 'ALL',
    parcelTracking?: string
  ) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

    const notif: NotificationItem = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: `${dateStr} ${timeStr}`,
      type,
      title,
      message,
      targetRole,
      parcelTracking,
      isRead: false,
    };
    this.data.notifications.unshift(notif);
    if (this.data.notifications.length > 200) {
      this.data.notifications = this.data.notifications.slice(0, 200);
    }
  }

  // --- Deletion and update methods for persistent integrity ---
  public deleteParcel(parcelId: string): boolean {
    const pIndex = this.data.parcels.findIndex((p) => p.id === parcelId);
    if (pIndex === -1) return false;
    const parcel = this.data.parcels[pIndex];
    this.data.parcels.splice(pIndex, 1);
    if (parcel.clientId) this.recalculateClient(parcel.clientId);
    if (parcel.shipmentId) this.recalculateShipment(parcel.shipmentId);
    this.persist();
    return true;
  }

  public deleteClient(clientId: string): boolean {
    const cIndex = this.data.clients.findIndex((c) => c.id === clientId);
    if (cIndex === -1) return false;
    this.data.clients.splice(cIndex, 1);
    this.persist();
    return true;
  }

  public deleteShipment(shipmentId: string): boolean {
    const sIndex = this.data.shipments.findIndex((s) => s.id === shipmentId);
    if (sIndex === -1) return false;
    // Unlink parcels
    this.data.parcels.forEach((p) => {
      if (p.shipmentId === shipmentId) {
        p.shipmentId = undefined;
        p.shipmentNumber = undefined;
      }
    });
    this.data.shipments.splice(sIndex, 1);
    this.persist();
    return true;
  }

  public deletePayment(paymentId: string): boolean {
    const pIndex = this.data.payments.findIndex((p) => p.id === paymentId);
    if (pIndex === -1) return false;
    const payment = this.data.payments[pIndex];
    this.data.payments.splice(pIndex, 1);
    if (payment.parcelId) this.recalculateParcel(payment.parcelId);
    if (payment.clientId) this.recalculateClient(payment.clientId);
    this.persist();
    return true;
  }

  public deleteExpense(expenseId: string): boolean {
    const eIndex = this.data.expenses.findIndex((e) => e.id === expenseId);
    if (eIndex === -1) return false;
    this.data.expenses.splice(eIndex, 1);
    this.persist();
    return true;
  }

  public deleteEmployee(employeeId: string): boolean {
    const eIndex = this.data.employees.findIndex((e) => e.id === employeeId);
    if (eIndex === -1) return false;
    this.data.employees.splice(eIndex, 1);
    this.persist();
    return true;
  }

  public deleteSalaryPayment(salaryId: string): boolean {
    const sIndex = this.data.salaryPayments.findIndex((s) => s.id === salaryId);
    if (sIndex === -1) return false;
    this.data.salaryPayments.splice(sIndex, 1);
    this.persist();
    return true;
  }

  public deleteUser(userId: string): boolean {
    const uIndex = this.data.users.findIndex((u) => u.id === userId);
    if (uIndex === -1) return false;
    this.data.users.splice(uIndex, 1);
    this.persist();
    return true;
  }

  public applySupabaseData(supabaseData: any) {
    if (!supabaseData) return;
    if (supabaseData.agencies) this.data.agencies = supabaseData.agencies;
    if (supabaseData.users) this.data.users = supabaseData.users;
    if (supabaseData.clients) this.data.clients = supabaseData.clients;
    if (supabaseData.parcels) this.data.parcels = supabaseData.parcels;
    if (supabaseData.shipments) this.data.shipments = supabaseData.shipments;
    if (supabaseData.payments) this.data.payments = supabaseData.payments;
    if (supabaseData.expenses) this.data.expenses = supabaseData.expenses;
    if (supabaseData.employees) this.data.employees = supabaseData.employees;
    if (supabaseData.salaryPayments) this.data.salaryPayments = supabaseData.salaryPayments;
    if (supabaseData.exchangeRates) this.data.exchangeRates = supabaseData.exchangeRates;
    if (supabaseData.auditLogs) this.data.auditLogs = supabaseData.auditLogs;
    if (supabaseData.notifications) this.data.notifications = supabaseData.notifications;

    // Recalculate
    this.data.clients.forEach((c) => this.recalculateClient(c.id));
    this.data.shipments.forEach((s) => this.recalculateShipment(s.id));
    this.persist();
  }

  // --- Getters & Queries ---
  public getData(): DatabaseSchema {
    return this.data;
  }

  public save() {
    this.persist();
  }

  // --- Dashboard Statistics Calculation ---
  public getDashboardStats(): DashboardStats {
    const parcels = this.data.parcels;
    const shipments = this.data.shipments;
    const payments = this.data.payments;
    const expenses = this.data.expenses;
    const clients = this.data.clients;
    const salaries = this.data.salaryPayments;

    const inChinaCount = parcels.filter((p) =>
      ['COMMANDE_CREEE', 'ATTENTE_RECEPTION_CHINE', 'RECU_CHINE', 'IDENTIFIE', 'CONTROLE', 'PREPARE_EXPEDITION', 'EXPEDITION_EN_PREPARATION'].includes(p.status)
    ).length;

    const inTransitCount = parcels.filter((p) =>
      ['EXPEDIE', 'EN_TRANSIT'].includes(p.status)
    ).length;

    const arrivedCount = parcels.filter((p) =>
      ['ARRIVE_DESTINATION', 'DEDOUANEMENT_TRAITEMENT'].includes(p.status)
    ).length;

    const availableCount = parcels.filter((p) =>
      ['DISPONIBLE_AGENCE', 'PREPARATION_LIVRAISON', 'EN_COURS_LIVRAISON'].includes(p.status)
    ).length;

    const deliveredCount = parcels.filter((p) =>
      ['LIVRE', 'RETIRE_CLIENT'].includes(p.status)
    ).length;

    const anomaliesCount = parcels.filter((p) => p.status === 'ANOMALIE').length;

    const maritimeShipments = shipments.filter((s) => s.transportMode === 'MARITIME').length;
    const aerienShipments = shipments.filter((s) => s.transportMode === 'AERIEN').length;
    const inProgressShipments = shipments.filter((s) =>
      ['EN_PREPARATION', 'EXPEDIE', 'EN_TRANSIT'].includes(s.status)
    ).length;
    const arrivedShipments = shipments.filter((s) =>
      ['ARRIVE', 'TRAITE'].includes(s.status)
    ).length;

    const totalRevenueUSD = payments.reduce((sum, p) => sum + (p.amountUSD || 0), 0);
    const totalExpensesUSD = expenses.reduce((sum, e) => sum + (e.amountUSD || 0), 0);
    const netBalanceUSD = totalRevenueUSD - totalExpensesUSD;

    const clientTotalPaidUSD = clients.reduce((sum, c) => sum + (c.totalPaidUSD || 0), 0);
    const clientTotalRemainingUSD = clients.reduce((sum, c) => sum + (c.remainingBalanceUSD || 0), 0);
    const totalSalariesPaidUSD = salaries.reduce((sum, s) => sum + (s.netSalaryUSD || 0), 0);

    const chinaExpensesUSD = expenses
      .filter((e) => e.country === 'Chine')
      .reduce((sum, e) => sum + (e.amountUSD || 0), 0);

    const kinshasaExpensesUSD = expenses
      .filter((e) => e.country === 'RDC')
      .reduce((sum, e) => sum + (e.amountUSD || 0), 0);

    const angolaExpensesUSD = expenses
      .filter((e) => e.country === 'Angola')
      .reduce((sum, e) => sum + (e.amountUSD || 0), 0);

    // Caisse breakdown per original currency
    const balancesByCurrency = {
      USD: payments.filter(p => p.currency === 'USD').reduce((s, p) => s + p.originalAmount, 0) -
           expenses.filter(e => e.currency === 'USD').reduce((s, e) => s + e.originalAmount, 0),
      CNY: payments.filter(p => p.currency === 'CNY').reduce((s, p) => s + p.originalAmount, 0) -
           expenses.filter(e => e.currency === 'CNY').reduce((s, e) => s + e.originalAmount, 0),
      CDF: payments.filter(p => p.currency === 'CDF').reduce((s, p) => s + p.originalAmount, 0) -
           expenses.filter(e => e.currency === 'CDF').reduce((s, e) => s + e.originalAmount, 0),
      AOA: payments.filter(p => p.currency === 'AOA').reduce((s, p) => s + p.originalAmount, 0) -
           expenses.filter(e => e.currency === 'AOA').reduce((s, e) => s + e.originalAmount, 0),
    };

    return {
      parcels: {
        total: parcels.length,
        inChina: inChinaCount,
        inTransit: inTransitCount,
        arrived: arrivedCount,
        availableAtAgency: availableCount,
        delivered: deliveredCount,
        anomalies: anomaliesCount,
      },
      shipments: {
        total: shipments.length,
        maritime: maritimeShipments,
        aerien: aerienShipments,
        inProgress: inProgressShipments,
        arrived: arrivedShipments,
      },
      finances: {
        totalRevenueUSD: Number(totalRevenueUSD.toFixed(2)),
        totalExpensesUSD: Number(totalExpensesUSD.toFixed(2)),
        netBalanceUSD: Number(netBalanceUSD.toFixed(2)),
        clientTotalPaidUSD: Number(clientTotalPaidUSD.toFixed(2)),
        clientTotalRemainingUSD: Number(clientTotalRemainingUSD.toFixed(2)),
        totalSalariesPaidUSD: Number(totalSalariesPaidUSD.toFixed(2)),
        chinaExpensesUSD: Number(chinaExpensesUSD.toFixed(2)),
        kinshasaExpensesUSD: Number(kinshasaExpensesUSD.toFixed(2)),
        angolaExpensesUSD: Number(angolaExpensesUSD.toFixed(2)),
        balancesByCurrency,
      },
      clients: {
        total: clients.length,
        active: clients.filter((c) => c.totalParcels > 0).length,
        withPendingBalance: clients.filter((c) => c.remainingBalanceUSD > 0).length,
      },
    };
  }
}

export const dbManager = new DatabaseManager();
