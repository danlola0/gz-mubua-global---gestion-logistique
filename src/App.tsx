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
  PaymentMethodConfig,
  NotificationItem,
  DashboardStats,
  ParcelStatus,
} from './types/index.ts';
import { api, createWhatsAppTrackingLink } from './services/api.ts';
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
    maritimePricePerCbm: 0,
    aerienPricePerKg: 0,
    freightRateCurrency: 'USD',
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
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
  const [parcelDetailAction, setParcelDetailAction] = useState<'edit' | 'delete' | undefined>(undefined);
  const [selectedParcelForLabel, setSelectedParcelForLabel] = useState<Parcel | null>(null);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);
  const [showNewParcelModal, setShowNewParcelModal] = useState(false);
  const [parcelSavedMessage, setParcelSavedMessage] = useState<string | null>(null);
  // Confirmation shown after each create / update / delete (errors are shown in the form itself).
  const [toast, setToast] = useState<string | null>(null);
  // Last registered parcel: lets the agent send its tracking number to the client right away.
  const [savedParcel, setSavedParcel] = useState<Parcel | null>(null);
  const [showNewShipmentModal, setShowNewShipmentModal] = useState(false);
  const [showPublicTracking, setShowPublicTracking] = useState(() => new URLSearchParams(window.location.search).has('suivi'));
  // A shared link ?suivi=COL-... opens the tracking with that number, even when signed in.
  const [publicTrackingSearchInitial, setPublicTrackingSearchInitial] = useState(
    () => new URLSearchParams(window.location.search).get('suivi')?.trim() || ''
  );

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
          isClient ? Promise.resolve([] as PaymentMethodConfig[]) : api.getPaymentMethods().catch(() => [] as PaymentMethodConfig[]),
        ]),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Le serveur met trop de temps à répondre (connexion internet lente ou coupée). Vérifiez votre connexion puis cliquez sur « Réessayer ».')),
            40000
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
        methodsData,
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
      setPaymentMethods(methodsData);

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
    await loadData();
  };

  const handleCreateParcel = async (data: any) => {
    const created = await api.createParcel(data);
    if (!created?.id || !created.trackingNumber) {
      throw new Error('Réponse inattendue de Supabase : le colis n’a pas été confirmé.');
    }
    setParcels((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
    setParcelSavedMessage(`Colis ${created.trackingNumber} enregistré dans Supabase.`);
    setSavedParcel(created);
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
    await loadData();
  };

  const handleConfirmArrivalKinshasa = async (shipmentId: string) => {
    if (!currentUser) return;
    await api.markShipmentArrived(shipmentId, {
      userName: currentUser.fullName,
      userId: currentUser.id,
      userRole: currentUser.role,
      agencyName: currentUser.agencyName,
    });
    await loadData();
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
    await loadData();
  };

  const handleCreateExpense = async (data: any) => {
    await api.createExpense(data);
    await loadData();
  };

  const handleCreateSalaryPayment = async (data: any) => {
    await api.createSalaryPayment(data);
    await loadData();
  };

  const handleCreateEmployee = async (data: any) => {
    await api.createEmployee(data);
    await loadData();
  };

  const handleCreateClient = async (data: any) => {
    await api.createClient(data);
    await loadData();
  };

  const handleDeleteParcel = async (id: string, withPayments = false) => {
    await api.deleteParcel(id, withPayments);
    setSelectedParcelForDetail(null);
    setParcelDetailAction(undefined);
    await loadData();
    setToast('Colis supprimé (trace conservée dans le journal d’audit).');
    window.setTimeout(() => setToast(null), 5000);
  };

  const handleUpdateParcel = async (id: string, data: Partial<Parcel>) => {
    const updated = await api.updateParcel(id, data);
    setParcelDetailAction(undefined);
    setSelectedParcelForDetail(updated);
    await loadData();
    setToast('Colis mis à jour.');
    window.setTimeout(() => setToast((c) => (c === 'Colis mis à jour.' ? null : c)), 5000);
  };

  // Runs a change against Supabase, reloads every list/dashboard, then confirms.
  // Errors propagate to the calling form/dialog, which displays them.
  const mutate = async (operation: () => Promise<unknown>, success: string) => {
    await operation();
    await loadData();
    setToast(success);
    window.setTimeout(() => setToast((current) => (current === success ? null : current)), 5000);
  };

  const handleDeleteClient = (id: string, withRecords = false) =>
    mutate(() => api.deleteClient(id, withRecords), withRecords ? 'Client supprimé avec ses colis et paiements (trace conservée dans le journal d’audit).' : 'Client supprimé.');
  const handleUpdateClient = (id: string, data: Partial<Client>) => mutate(() => api.updateClient(id, data), 'Fiche client mise à jour.');
  const handleDeleteShipment = (id: string) => mutate(() => api.deleteShipment(id), 'Expédition supprimée.');
  const handleUpdateShipment = (id: string, data: Partial<Shipment>) => mutate(() => api.updateShipment(id, data), 'Expédition mise à jour.');
  const handleUpdatePayment = (id: string, data: Partial<Payment>) => mutate(() => api.updatePayment(id, data), 'Reçu corrigé ; soldes du colis et du client recalculés.');
  const handleDeletePayment = (id: string) =>
    mutate(async () => {
      await api.deletePayment(id);
      setSelectedPaymentForReceipt(null);
    }, 'Reçu supprimé ; soldes recalculés (trace conservée dans le journal d’audit).');
  const handleDeleteExpense = (id: string) => mutate(() => api.deleteExpense(id), 'Dépense supprimée (trace conservée dans le journal d’audit).');
  const handleUpdateExpense = (id: string, data: Partial<Expense>) => mutate(() => api.updateExpense(id, data), 'Dépense corrigée.');
  const handleDeleteEmployee = (id: string) => mutate(() => api.deleteEmployee(id), 'Employé supprimé.');
  const handleUpdateEmployee = (id: string, data: Partial<Employee>) => mutate(() => api.updateEmployee(id, data), 'Fiche employé mise à jour.');
  const handleUpdateSalaryPayment = (id: string, data: Partial<SalaryPayment>) =>
    mutate(() => api.updateSalaryPayment(id, data), 'Bulletin corrigé ; la dépense de salaire liée a été mise à jour.');
  const handleDeleteSalaryPayment = (id: string) =>
    mutate(() => api.deleteSalaryPayment(id), 'Bulletin supprimé avec sa dépense de salaire (trace conservée dans le journal d’audit).');
  const handleDeleteUser = (id: string) => mutate(() => api.deleteUser(id), 'Utilisateur supprimé.');
  const handleUpdateUser = (id: string, data: Partial<User>) => mutate(() => api.updateUser(id, data), 'Utilisateur mis à jour.');
  const handleCreatePaymentMethod = (data: Partial<PaymentMethodConfig>) => mutate(() => api.createPaymentMethod(data), 'Moyen de paiement ajouté.');
  const handleUpdatePaymentMethod = (id: string, data: Partial<PaymentMethodConfig>) => mutate(() => api.updatePaymentMethod(id, data), 'Moyen de paiement mis à jour.');
  const handleResetUserPassword = (id: string, password: string) =>
    mutate(() => api.resetUserPassword(id, password), 'Mot de passe réinitialisé.');

  const handleUpdateRates = async (ratesData: Partial<ExchangeRates>) => {
    const updated = await api.updateExchangeRates(ratesData);
    setExchangeRates(updated);
    await loadData();
  };

  const handleCreateAgency = async (agencyData: Partial<Agency>) => {
    await api.createAgency(agencyData);
    await loadData();
  };

  const handleCreateUser = (userData: Partial<User>) =>
    mutate(() => api.createUser(userData), userData.password ? 'Utilisateur créé : il peut se connecter avec son mot de passe.' : 'Invitation envoyée par e-mail.');

  const handleMarkNotificationRead = async (id: string | 'all') => {
    try {
      await api.markNotificationRead(id);
    } catch (err) {
      console.error('[Notifications] Marquage impossible:', err);
      return;
    }
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
        <div className="mb-4 rounded-xl bg-white px-3 py-2">
          <img src="/logo.png" alt="GZ Mubua Global" className="h-20 w-auto object-contain" />
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
              onEditParcel={
                currentUser.role === 'admin'
                  ? (p) => {
                      setParcelDetailAction('edit');
                      setSelectedParcelForDetail(p);
                    }
                  : undefined
              }
              onDeleteParcel={
                currentUser.role === 'admin'
                  ? (p) => {
                      setParcelDetailAction('delete');
                      setSelectedParcelForDetail(p);
                    }
                  : undefined
              }
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
              onUpdateShipment={handleUpdateShipment}
              onDeleteShipment={handleDeleteShipment}
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
              onUpdatePayment={handleUpdatePayment}
              onDeletePayment={handleDeletePayment}
              agencies={agencies}
              paymentMethods={paymentMethods}
              userAgencyId={currentUser.agencyId}
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
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
              paymentMethods={paymentMethods}
              userAgencyId={currentUser.agencyId}
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
              onUpdateSalaryPayment={handleUpdateSalaryPayment}
              onDeleteSalaryPayment={handleDeleteSalaryPayment}
              onUpdateEmployee={handleUpdateEmployee}
              onDeleteEmployee={handleDeleteEmployee}
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
              onCreateActivationCode={(clientId) => api.createClientActivationCode(clientId)}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
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
              agencies={agencies}
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
              onCreateAgency={handleCreateAgency}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onResetUserPassword={handleResetUserPassword}
              currentUserId={currentUser.id}
              paymentMethods={paymentMethods}
              onCreatePaymentMethod={handleCreatePaymentMethod}
              onUpdatePaymentMethod={handleUpdatePaymentMethod}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      {selectedParcelForDetail && (
        <ParcelDetailModal
          key={`${selectedParcelForDetail.id}-${parcelDetailAction || 'view'}`}
          initialAction={parcelDetailAction}
          parcel={selectedParcelForDetail}
          userRole={currentUser.role}
          userName={currentUser.fullName}
          userId={currentUser.id}
          userAgencyName={currentUser.agencyName}
          onClose={() => {
            setSelectedParcelForDetail(null);
            setParcelDetailAction(undefined);
          }}
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

      {toast && !parcelSavedMessage && (
        <p
          role="status"
          className="fixed bottom-4 right-4 left-4 sm:left-auto z-[70] rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-lg sm:max-w-sm"
        >
          ✓ {toast}
        </p>
      )}

      {parcelSavedMessage && (
        <div
          role="status"
          className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-lg space-y-2 sm:max-w-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <span>{parcelSavedMessage}</span>
            <button
              type="button"
              onClick={() => {
                setParcelSavedMessage(null);
                setSavedParcel(null);
              }}
              className="text-emerald-700 hover:text-emerald-900"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          {savedParcel && savedParcel.clientPhone && (
            <a
              href={createWhatsAppTrackingLink(savedParcel)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 font-bold text-white"
            >
              Envoyer le numéro {savedParcel.trackingNumber} au client (WhatsApp)
            </a>
          )}
        </div>
      )}

      {showNewParcelModal && (
        <NewParcelModal
          clients={clients}
          agencies={agencies}
          exchangeRates={exchangeRates}
          paymentMethods={paymentMethods}
          onClose={() => setShowNewParcelModal(false)}
          onCreateParcel={handleCreateParcel}
          userName={currentUser.fullName}
          userId={currentUser.id}
          userRole={currentUser.role}
          userAgencyId={currentUser.agencyId}
        />
      )}

      {showNewShipmentModal && (
        <NewShipmentModal
          agencies={
            currentUser.role === 'china_team'
              ? agencies.filter((a) => a.id === currentUser.agencyId || a.type === 'destination' || a.country !== 'Chine')
              : agencies
          }
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
          paymentMethods={paymentMethods}
          onClose={() => setSelectedPaymentForReceipt(null)}
        />
      )}
    </div>
  );
}
