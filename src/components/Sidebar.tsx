import React from 'react';
import {
  LayoutDashboard,
  Package,
  Ship,
  Users,
  Building2,
  DollarSign,
  TrendingDown,
  UserCheck,
  Settings,
  MapPin,
  ClipboardList,
  Truck,
  Layers,
  ArrowRightLeft,
  FileText,
  BadgeAlert,
} from 'lucide-react';
import type { UserRole } from '../types/index.ts';

export type NavTab =
  | 'dashboard'
  | 'parcels'
  | 'china_ops'
  | 'kinshasa_ops'
  | 'shipments'
  | 'clients'
  | 'cashier'
  | 'expenses'
  | 'payroll'
  | 'users'
  | 'audit'
  | 'settings'
  | 'client_portal';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  userRole: UserRole;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  isMobileOpen,
  onCloseMobile,
}) => {
  interface NavItem {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: UserRole[];
    badge?: string;
  }

  const navItems: NavItem[] = [
    // Client view specific
    {
      id: 'client_portal',
      label: 'Espace Mes Colis',
      icon: Package,
      roles: ['client'],
    },
    // Internal Staff items
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: LayoutDashboard,
      roles: ['admin', 'china_team', 'kinshasa_team', 'cashier'],
    },
    {
      id: 'parcels',
      label: 'Gestion des Colis',
      icon: Package,
      roles: ['admin', 'china_team', 'kinshasa_team'],
    },
    {
      id: 'china_ops',
      label: 'Opérations Chine',
      icon: Building2,
      roles: ['admin', 'china_team'],
      badge: 'Hub GZ',
    },
    {
      id: 'shipments',
      label: 'Expéditions (Fret)',
      icon: Ship,
      roles: ['admin', 'china_team', 'kinshasa_team'],
    },
    {
      id: 'kinshasa_ops',
      label: 'Opérations Kinshasa',
      icon: Truck,
      roles: ['admin', 'kinshasa_team'],
      badge: 'Dépôt',
    },
    {
      id: 'clients',
      label: 'Gestion Clients',
      icon: Users,
      roles: ['admin', 'china_team', 'kinshasa_team', 'cashier'],
    },
    {
      id: 'cashier',
      label: 'Caisse & Recettes',
      icon: DollarSign,
      roles: ['admin', 'cashier'],
    },
    {
      id: 'expenses',
      label: 'Dépenses & Frais',
      icon: TrendingDown,
      roles: ['admin', 'cashier'],
    },
    {
      id: 'payroll',
      label: 'Salaires & RH',
      icon: UserCheck,
      roles: ['admin'],
    },
    {
      id: 'audit',
      label: 'Journal d’Audit',
      icon: ClipboardList,
      roles: ['admin'],
    },
    {
      id: 'settings',
      label: 'Taux & Paramètres',
      icon: Settings,
      roles: ['admin'],
    },
  ];

  const allowedItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-30 lg:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 shadow-2xl lg:shadow-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
      <div className="p-4 flex-1 overflow-y-auto space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {userRole === 'client' ? 'Espace Client' : 'Menu Opérationnel'}
        </div>

        {allowedItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    isActive ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Agency locations summary in sidebar footer */}
      <div className="p-3 m-3 bg-slate-800/60 rounded-xl border border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 font-bold text-slate-300 mb-1">
          <MapPin className="w-3.5 h-3.5 text-amber-400" /> Hubs GZ MUBUA
        </div>
        <div className="space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span className="text-slate-300">🇨🇳 Guangzhou / Yiwu</span>
            <span className="text-emerald-400">Opérationnel</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-300">🇨🇩 Kinshasa (Gombe & Limete)</span>
            <span className="text-emerald-400">Ouvert</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-300">🇦🇴 Luanda (Viana)</span>
            <span className="text-emerald-400">Ouvert</span>
          </div>
        </div>
      </div>
    </aside>
  </>
  );
};
