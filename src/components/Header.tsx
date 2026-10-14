import React, { useState } from 'react';
import {
  Bell,
  Search,
  Globe,
  ChevronDown,
  LogOut,
  UserCheck,
  Package,
  Ship,
  DollarSign,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Menu,
  X,
} from 'lucide-react';
import type { User, ExchangeRates, NotificationItem, UserRole } from '../types/index.ts';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';
import { InstallAppButton } from './InstallAppButton.tsx';

interface HeaderProps {
  currentUser: User;
  exchangeRates: ExchangeRates;
  notifications: NotificationItem[];
  onSignOut: () => Promise<void>;
  onOpenPublicTracking: () => void;
  onMarkNotificationRead: (id: string | 'all') => void;
  onSelectParcelTracking?: (trackingNumber: string) => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  exchangeRates,
  notifications,
  onSignOut,
  onOpenPublicTracking,
  onMarkNotificationRead,
  onSelectParcelTracking,
  isMobileMenuOpen,
  onToggleMobileMenu,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [searchTrackingInput, setSearchTrackingInput] = useState('');

  const unreadNotifs = notifications.filter((n) => !n.isRead);

  const roleLabels: Record<UserRole, { label: string; tag: string; color: string }> = {
    admin: { label: 'Administrateur', tag: 'Accès Total', color: 'bg-rose-600' },
    china_team: { label: 'Équipe Chine (Guangzhou)', tag: 'Hub Chine', color: 'bg-amber-600' },
    kinshasa_team: { label: 'Équipe Kinshasa', tag: 'Dépôt Limete', color: 'bg-emerald-600' },
    cashier: { label: 'Caissier / Finances', tag: 'Caisse', color: 'bg-blue-600' },
    client: { label: 'Client (Espace Particulier)', tag: 'Client', color: 'bg-purple-600' },
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTrackingInput.trim() && onSelectParcelTracking) {
      onSelectParcelTracking(searchTrackingInput.trim());
      setSearchTrackingInput('');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 h-16">
        {/* Mobile Hamburger & Brand & Route info */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
              aria-label="Menu de navigation"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
            </button>
          )}

          <div className="h-9 sm:h-10 shrink-0 rounded-lg bg-white px-1 flex items-center shadow-lg shadow-amber-500/20">
            <img src="/logo-mark.png" alt="GZ Mubua Global" className="h-full w-auto object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-base sm:text-lg text-white">
                GZ MUBUA GLOBAL
              </span>
              <span className="hidden md:inline-block text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Chine • Kinshasa • Angola
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium line-clamp-1">
              Fret Maritime & Aérien International
            </p>
          </div>
        </div>

        {/* Live Rates Ticker (Hidden on mobile) */}
        <div className="hidden xl:flex items-center gap-4 px-3 py-1.5 bg-slate-800/80 rounded-lg border border-slate-700 text-xs">
          <span className="text-slate-400 flex items-center gap-1 font-semibold">
            <Globe className="w-3.5 h-3.5 text-amber-400" /> Taux du jour :
          </span>
          <span className="font-mono text-slate-200">1 $ = {exchangeRates.CNY} ¥</span>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-slate-200">1 $ = {exchangeRates.CDF} FC</span>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-slate-200">1 $ = {exchangeRates.AOA} Kz</span>
        </div>

        {/* Quick Search & Public Tracking Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Suivre par numéro de colis..."
              value={searchTrackingInput}
              onChange={(e) => setSearchTrackingInput(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 w-56 lg:w-64 transition-all"
            />
          </form>

          <InstallAppButton />
          <LanguageSwitcher />

          <button
            onClick={onOpenPublicTracking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-sm transition-all"
            title="Consulter le suivi public en temps réel"
          >
            <Package className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Portail Suivi</span>
          </button>

          {/* Notifications dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Notifications système"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifs.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-bounce">
                  {unreadNotifs.length}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-96 sm:w-96 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
                  <div className="font-semibold text-sm text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" /> Notifications internes
                  </div>
                  {unreadNotifs.length > 0 && (
                    <button
                      onClick={() => onMarkNotificationRead('all')}
                      className="text-xs text-amber-400 hover:underline"
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">Aucune notification</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          onMarkNotificationRead(n.id);
                          if (n.parcelTracking && onSelectParcelTracking) {
                            onSelectParcelTracking(n.parcelTracking);
                            setShowNotifMenu(false);
                          }
                        }}
                        className={`p-2.5 rounded-lg text-xs cursor-pointer transition border ${
                          n.isRead
                            ? 'bg-slate-800/40 border-transparent text-slate-400'
                            : 'bg-slate-700/60 border-amber-500/30 text-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-bold text-white">{n.title}</span>
                          <span className="text-[10px] text-slate-400">{n.timestamp}</span>
                        </div>
                        <p className="mt-1 text-slate-300">{n.message}</p>
                        {n.parcelTracking && (
                          <span className="inline-block mt-1 font-mono text-[10px] text-amber-400 font-semibold bg-amber-950/50 px-1.5 py-0.5 rounded">
                            {n.parcelTracking}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Authenticated user profile */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs transition"
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-white text-[11px] ${roleLabels[currentUser.role].color}`}>
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <div className="font-semibold text-white leading-tight truncate max-w-[130px]">
                  {currentUser.fullName}
                </div>
                <div className="text-[10px] text-amber-400 leading-tight">
                  {roleLabels[currentUser.role].label}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-72 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-2 z-50">
                <div className="p-2 border-b border-slate-700 mb-1">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                    Compte connecté
                  </p>
                  <p className="font-bold text-sm text-white">{currentUser.fullName}</p>
                  <p className="text-xs text-slate-400">{currentUser.agencyName}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowRoleMenu(false);
                    void onSignOut();
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-rose-300 transition hover:bg-slate-700"
                >
                  <LogOut className="h-4 w-4" /> Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
