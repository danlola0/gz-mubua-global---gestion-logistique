/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
} from './types/index.ts';
import { api } from './services/api.ts';
import { Header } from './components/Header.tsx';
import { Sidebar, type NavTab } from './components/Sidebar.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { ParcelsView } from './views/ParcelsView.tsx';
import { ChinaOperationsView } from './views/ChinaOperationsView.tsx';
import { KinshasaOperationsView } from './views/KinshasaOperationsView.tsx';
import { ShipmentsView } from './views/ShipmentsView.tsx';
import { CashierView } from './views/CashierView.tsx';
import { ExpensesView } from './views/ExpensesView.tsx';
import { PayrollView } from './views/PayrollView.tsx';
import { ClientsView } from './views/ClientsView.tsx';
import { ClientPortalView } from './views/ClientPortalView.tsx';
import { PublicTrackingView } from './views/PublicTrackingView.tsx';
import { AuditLogsView } from './views/AuditLogsView.tsx';
import { SettingsView } from './views/SettingsView.tsx';

// Modals
import { ParcelDetailModal } from './components/ParcelDetailModal.tsx';
import { NewParcelModal } from './components/NewParcelModal.tsx';
import { ParcelLabelModal } from './components/ParcelLabelModal.tsx';
import { PaymentReceiptModal } from './components/PaymentReceiptModal.tsx';
import { NewShipmentModal } from './components/NewShipmentModal.tsx';
import { SplashScreen } from './components/SplashScreen.tsx';

interface AppProps {
  authenticatedUser: User;
  onSignOut: () => Promise<void>;
}

export default function App({ authenticatedUser, onSignOut }: AppProps) {
  // Global Application State
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(authenticatedUser);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({
    USD: 1,
    CNY: 7.25,
    CDF: 2850,
    AOA: 920,
    lastUpdated: '2026-10-07',
    maritimePricePerKg: 0,
    aerienPricePerKg: 0,
    freightRateCurrency: 'USD',
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  // Navigation State
  const [currentTab, setCurrentTab] = useState<NavTab>(
    authenticatedUser.role === 'client' ? 'client_portal' : 'dashboard'
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals state
  const [selectedParcelForDetail, setSelectedParcelForDetail] = useState<Parcel | null>(null);
  const [selectedParcelForLabel, setSelectedParcelForLabel] = useState<Parcel | null>(null);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);
  const [showNewParcelModal, setShowNewParcelModal] = useState(false);
  const [parcelSavedMessage, setParcelSavedMessage] = useState<string | null>(null);
  const [showNewShipmentModal, setShowNewShipmentModal] = useState(false);
  const [showPublicTracking, setShowPublicTracking] = useState(false);
  const [publicTrackingSearchInitial, setPublicTrackingSearchInitial] = useState('');

  // Initial load from backend
  const loadData = async () => {
    setLoadError(null);
    const role = authenticatedUser.role;
    const isAdmin = role === 'admin';
    const isCashier = role === 'cashier';
    const isClient = role === 'client';
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const loadedData = await Promise.race([
        Promise.all([
          isAdmin ? api.getUsers() : Promise.resolve([] as User[]),
          api.getAgencies(),
          isClient ? Promise.resolve([] as Client[]) : api.getClients(),
          api.getParcels(),
          isClient ? Promise.resolve([] as Shipment[]) : api.getShipments(),
          isAdmin || isCashier || isClient ? api.getPayments() : Promise.resolve([] as Payment[]),
          isAdmin || isCashier ? api.getExpenses() : Promise.resolve([] as Expense[]),
          isAdmin ? api.getEmployees() : Promise.resolve([] as Employee[]),
          isAdmin ? api.getSalaries() : Promise.resolve([] as SalaryPayment[]),
          api.getExchangeRates(),
          isAdmin ? api.getAuditLogs() : Promise.resolve([] as AuditLogItem[]),
          api.getNotifications(),
          isClient ? Promise.resolve(null) : api.getDashboardStats(),
        ]),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Le serveur API ne répond pas. Vérifiez le routage Firebase vers le service API configuré.')),
            15000
          );
        }),
      ]);

      const [
        usersData,
        agenciesData,
        clientsData,
        parcelsData,
        shipmentsData,
        paymentsData,
        expensesData,
        employeesData,
        salariesData,
        ratesData,
        logsData,
        notifsData,
        statsData,
      ] = loadedData;

      setUsers(usersData);
      setAgencies(agenciesData);
      setClients(clientsData);
      setParcels(parcelsData);
      setShipments(shipmentsData);
      setPayments(paymentsData);
      setExpenses(expensesData);
      setEmployees(employeesData);
      setSalaryPayments(salariesData);
      setExchangeRates(ratesData);
      setAuditLogs(logsData);
      setNotifications(notifsData);
      setDashboardStats(statsData);

    } catch (err) {
      console.error('Error loading data from backend:', err);
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les données du serveur. Vérifiez la connexion puis réessayez.'
      );
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Actions
  const handleUpdateParcelStatus = async (id: string, params: any) => {
    if (!currentUser) return;
    const updated = await api.updateParcelStatus(id, {
      ...params,
      userName: currentUser.fullName,
      userId: currentUser.id,
      userRole: currentUser.role,
      agencyName: currentUser.agencyName,
    });
    setParcels((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setSelectedParcelForDetail(updated);
    // Reload stats and logs
    loadData();
  };

  const handleCreateParcel = async (data: any) => {
    const created = await api.createParcel(data);
    if (!created?.id || !created.trackingNumber) {
      throw new Error('Réponse inattendue de Supabase : le colis n’a pas été confirmé.');
    }
    setParcels((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
    setParcelSavedMessage(`Colis ${created.trackingNumber} enregistré dans Supabase.`);
    setTimeout(() => setParcelSavedMessage(null), 5000);
    // Refresh list, client balances and stats from Supabase.
    await loadData();
  };

  const handleCreateShipment = async (data: any) => {
    await api.createShipment(data);
    await loadData();
  };

  const handleQuickReceiveChina = async (parcelId: string) => {
    if (!currentUser) return;
    await handleUpdateParcelStatus(parcelId, {
      status: 'RECU_CHINE',
      comment: 'Réception physique et contrôle d’emballage validés à l’entrepôt en Chine.',
    });
  };

  const handleTransmitChinaToKinshasa = async (shipmentId: string) => {
    if (!currentUser) return;
    await api.markShipmentDeparted(shipmentId, {
      userName: currentUser.fullName,
      userId: currentUser.id,
      userRole: currentUser.role,
    });
    loadData();
  };

  const handleConfirmArrivalKinshasa = async (shipmentId: string) => {
    if (!currentUser) return;
    await api.markShipmentArrived(shipmentId, {
      userName: currentUser.fullName,
      userId: currentUser.id,
      userRole: currentUser.role,
      agencyName: currentUser.agencyName,
    });
    loadData();
  };

  const handleMarkParcelReady = async (parcelId: string, location: string) => {
    await handleUpdateParcelStatus(parcelId, {
      status: 'DISPONIBLE_AGENCE',
      warehouseLocation: location,
      comment: `Colis disponible pour retrait au guichet. Emplacement : ${location}`,
    });
  };

  const handleDispatchDelivery = async (parcelId: string, driverName: string, driverPhone: string) => {
    await handleUpdateParcelStatus(parcelId, {
      status: 'EN_COURS_LIVRAISON',
      deliveryDriverName: driverName,
      deliveryDriverPhone: driverPhone,
      comment: `Colis en cours de livraison porte-à-porte par ${driverName} (${driverPhone}).`,
    });
  };

  const handleConfirmDelivered = async (parcelId: string, recipient: string) => {
    await handleUpdateParcelStatus(parcelId, {
      status: 'LIVRE',
      deliveryRecipient: recipient,
      comment: `Colis remis en main propre au destinataire : ${recipient}. Décharge signée.`,
    });
  };

  const handleCreatePayment = async (data: any) => {
    await api.createPayment(data);
    loadData();
  };

  const handleCreateExpense = async (data: any) => {
    await api.createExpense(data);
    loadData();
  };

  const handleCreateSalaryPayment = async (data: any) => {
    await api.createSalaryPayment(data);
    loadData();
  };

  const handleCreateEmployee = async (data: any) => {
    await api.createEmployee(data);
    loadData();
  };

  const handleCreateClient = async (data: any) => {
    await api.createClient(data);
    loadData();
  };

  const handleDeleteParcel = async (id: string, withPayments = false) => {
    await api.deleteParcel(id, withPayments);
    setSelectedParcelForDetail(null);
    await loadData();
  };

  const handleUpdateParcel = async (id: string, data: Partial<Parcel>) => {
    const updated = await api.updateParcel(id, data);
    setSelectedParcelForDetail(updated);
    await loadData();
  };

  const handleDeleteClient = async (id: string) => {
    await api.deleteClient(id);
    await loadData();
  };

  const handleUpdateClient = async (id: string, data: Partial<Client>) => {
    await api.updateClient(id, data);
    await loadData();
  };

  const handleDeleteShipment = async (id: string) => {
    await api.deleteShipment(id);
    await loadData();
  };

  const handleUpdateShipment = async (id: string, data: Partial<Shipment>) => {
    await api.updateShipment(id, data);
    await loadData();
  };

  const handleDeletePayment = async (id: string) => {
    await api.deletePayment(id);
    setSelectedPaymentForReceipt(null);
    await loadData();
  };

  const handleDeleteExpense = async (id: string) => {
    await api.deleteExpense(id);
    await loadData();
  };

  const handleUpdateExpense = async (id: string, data: Partial<Expense>) => {
    await api.updateExpense(id, data);
    await loadData();
  };

  const handleDeleteEmployee = async (id: string) => {
    await api.deleteEmployee(id);
    await loadData();
  };

  const handleUpdateEmployee = async (id: string, data: Partial<Employee>) => {
    await api.updateEmployee(id, data);
    await loadData();
  };

  const handleDeleteSalaryPayment = async (id: string) => {
    await api.deleteSalaryPayment(id);
    await loadData();
  };

  const handleDeleteUser = async (id: string) => {
    await api.deleteUser(id);
    await loadData();
  };

  const handleUpdateRates = async (ratesData: Partial<ExchangeRates>) => {
    const updated = await api.updateExchangeRates(ratesData);
    setExchangeRates(updated);
    loadData();
  };

  const handleCreateUser = async (userData: Partial<User>) => {
    await api.createUser(userData);
    loadData();
  };

  const handleMarkNotificationRead = async (id: string | 'all') => {
    await api.markNotificationRead(id);
    if (id === 'all') {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } else {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    }
  };

  const handleSelectParcelTrackingNumber = (trackingNumber: string) => {
    const found = parcels.find((p) => p.trackingNumber.toUpperCase() === trackingNumber.toUpperCase());
    if (found) {
      setSelectedParcelForDetail(found);
    } else {
      setPublicTrackingSearchInitial(trackingNumber);
      setShowPublicTracking(true);
    }
  };

  const dataLoadErrorBanner = loadError && (
    <div role="alert" className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {loadError}
    </div>
  );

  if (isLoading) {
    return <SplashScreen message="Chargement de vos données logistiques…" />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 text-center text-white">
        <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-2xl mb-4">
          GZ
        </div>
        <div className="text-lg font-bold">GZ MUBUA GLOBAL</div>
        <p className="mt-2 max-w-md text-sm text-slate-400" role="alert">
          {loadError || 'Aucun utilisateur configuré dans Supabase. Créez un utilisateur autorisé avant de poursuivre.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setIsLoading(true);
            void loadData();
          }}
          className="mt-6 rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-amber-400"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        exchangeRates={exchangeRates}
        notifications={notifications}
        onSignOut={onSignOut}
        onOpenPublicTracking={() => {
          setPublicTrackingSearchInitial('');
          setShowPublicTracking(true);
        }}
        onMarkNotificationRead={handleMarkNotificationRead}
        onSelectParcelTracking={handleSelectParcelTrackingNumber}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex flex-1">
        {/* Dynamic Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          userRole={currentUser.role}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content View Container */}
        <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full overflow-x-hidden">
          {/* Public Tracking Overlay */}
          {showPublicTracking && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md p-4 sm:p-6">
              <PublicTrackingView
                onClose={() => setShowPublicTracking(false)}
                initialTracking={publicTrackingSearchInitial}
              />
            </div>
          )}

          {/* Active View */}
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={dashboardStats}
              parcels={parcels}
              shipments={shipments}
              userRole={currentUser.role}
              loadError={loadError}
              onOpenNewParcel={() => setShowNewParcelModal(true)}
              onOpenNewShipment={() => setShowNewShipmentModal(true)}
              onOpenNewPayment={() => setCurrentTab('cashier')}
              onSelectParcel={(p) => setSelectedParcelForDetail(p)}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'parcels' && (
            <ParcelsView
              parcels={parcels}
              userRole={currentUser.role}
              onOpenNewParcel={() => setShowNewParcelModal(true)}
              onSelectParcel={(p) => setSelectedParcelForDetail(p)}
              onOpenLabel={(p) => setSelectedParcelForLabel(p)}
              onOpenPaymentForParcel={(p) => {
                setCurrentTab('cashier');
              }}
            />
          )}

          {currentTab === 'china_ops' && (
            <ChinaOperationsView
              parcels={parcels}
              shipments={shipments}
              userRole={currentUser.role}
              onOpenNewParcel={() => setShowNewParcelModal(true)}
              onOpenNewShipment={() => setShowNewShipmentModal(true)}
              onSelectParcel={(p) => setSelectedParcelForDetail(p)}
              onSelectShipment={(s) => setCurrentTab('shipments')}
              onQuickReceive={handleQuickReceiveChina}
              onTransmitToKinshasa={handleTransmitChinaToKinshasa}
            />
          )}

          {currentTab === 'kinshasa_ops' && (
            <KinshasaOperationsView
              parcels={parcels}
              shipments={shipments}
              userRole={currentUser.role}
              onSelectParcel={(p) => setSelectedParcelForDetail(p)}
              onConfirmArrival={handleConfirmArrivalKinshasa}
              onMarkParcelReady={handleMarkParcelReady}
              onDispatchDelivery={handleDispatchDelivery}
              onConfirmDelivered={handleConfirmDelivered}
              onOpenPaymentForParcel={(p) => {
                setCurrentTab('cashier');
              }}
            />
          )}

          {currentTab === 'shipments' && (
            <ShipmentsView
              shipments={shipments}
              parcels={parcels}
              userRole={currentUser.role}
              onOpenNewShipment={() => setShowNewShipmentModal(true)}
              onDepartShipment={handleTransmitChinaToKinshasa}
              onArriveShipment={handleConfirmArrivalKinshasa}
              onSelectParcel={(p) => setSelectedParcelForDetail(p)}
            />
          )}

          {currentTab === 'cashier' && (
            <CashierView
              payments={payments}
              expenses={expenses}
              clients={clients}
              parcels={parcels}
              exchangeRates={exchangeRates}
              userRole={currentUser.role}
              userName={currentUser.fullName}
              userId={currentUser.id}
              onOpenReceipt={(pay) => setSelectedPaymentForReceipt(pay)}
              onCreatePayment={handleCreatePayment}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpensesView
              expenses={expenses}
              agencies={agencies}
              userRole={currentUser.role}
              userName={currentUser.fullName}
              userId={currentUser.id}
              onCreateExpense={handleCreateExpense}
            />
          )}

          {currentTab === 'payroll' && (
            <PayrollView
              employees={employees}
              salaryPayments={salaryPayments}
              agencies={agencies}
              userRole={currentUser.role}
              userName={currentUser.fullName}
              userId={currentUser.id}
              onCreateSalaryPayment={handleCreateSalaryPayment}
              onCreateEmployee={handleCreateEmployee}
            />
          )}

          {currentTab === 'clients' && (
            <ClientsView
              clients={clients}
              parcels={parcels}
              payments={payments}
              userRole={currentUser.role}
              userName={currentUser.fullName}
              userId={currentUser.id}
              onCreateClient={handleCreateClient}
              onSelectParcel={(p) => setSelectedParcelForDetail(p)}
              onOpenPaymentForParcel={(p) => {
                setCurrentTab('cashier');
              }}
            />
          )}

          {currentTab === 'client_portal' && (
            <ClientPortalView
              currentUser={currentUser}
              parcels={parcels}
              payments={payments}
              onSelectParcel={(p) => setSelectedParcelForDetail(p)}
              onOpenPublicTracking={() => setShowPublicTracking(true)}
            />
          )}

          {currentTab === 'audit' && <AuditLogsView logs={auditLogs} />}

          {(currentTab === 'settings' || currentTab === 'users') && (
            <SettingsView
              exchangeRates={exchangeRates}
              agencies={agencies}
              users={users}
              onUpdateRates={handleUpdateRates}
              onCreateUser={handleCreateUser}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      {selectedParcelForDetail && (
        <ParcelDetailModal
          parcel={selectedParcelForDetail}
          userRole={currentUser.role}
          userName={currentUser.fullName}
          userId={currentUser.id}
          userAgencyName={currentUser.agencyName}
          onClose={() => setSelectedParcelForDetail(null)}
          onUpdateStatus={handleUpdateParcelStatus}
          onOpenLabel={(p) => setSelectedParcelForLabel(p)}
          onOpenPaymentForParcel={(p) => {
            setSelectedParcelForDetail(null);
            setCurrentTab('cashier');
          }}
          onDeleteParcel={currentUser.role === 'admin' ? handleDeleteParcel : undefined}
          onUpdateParcel={currentUser.role === 'admin' ? handleUpdateParcel : undefined}
        />
      )}

      {parcelSavedMessage && (
        <p
          role="status"
          className="fixed bottom-4 right-4 z-50 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-lg"
        >
          {parcelSavedMessage}
        </p>
      )}

      {showNewParcelModal && (
        <NewParcelModal
          clients={clients}
          agencies={agencies}
          exchangeRates={exchangeRates}
          onClose={() => setShowNewParcelModal(false)}
          onCreateParcel={handleCreateParcel}
          userName={currentUser.fullName}
          userId={currentUser.id}
          userRole={currentUser.role}
        />
      )}

      {showNewShipmentModal && (
        <NewShipmentModal
          agencies={agencies}
          onClose={() => setShowNewShipmentModal(false)}
          onCreateShipment={handleCreateShipment}
        />
      )}

      {selectedParcelForLabel && (
        <ParcelLabelModal
          parcel={selectedParcelForLabel}
          onClose={() => setSelectedParcelForLabel(null)}
        />
      )}

      {selectedPaymentForReceipt && (
        <PaymentReceiptModal
          payment={selectedPaymentForReceipt}
          onClose={() => setSelectedPaymentForReceipt(null)}
        />
      )}
    </div>
  );
}
