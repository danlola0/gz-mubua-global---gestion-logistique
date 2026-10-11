import React, { useState } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  User,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { AuditLogItem } from '../types/index.ts';

interface AuditLogsViewProps {
  logs: AuditLogItem[];
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      log.userName.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q);

    const matchAction = actionFilter === 'ALL' || log.action === actionFilter;
    const matchEntity = entityFilter === 'ALL' || log.entityType === entityFilter;

    return matchSearch && matchAction && matchEntity;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'DELETE':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'STATUS_CHANGE':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'PAYMENT':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'EXPENSE':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'LOGIN':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Journal d'Audit & Traçabilité (Sécurité)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
              {logs.length} événements enregistrés
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Historique immuable de toutes les créations, modifications de statuts, encaissements et
            dépenses.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher par opérateur, détail, référence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="ALL">Toutes les actions</option>
            <option value="CREATE">Création</option>
            <option value="STATUS_CHANGE">Changement de statut</option>
            <option value="PAYMENT">Encaissement</option>
            <option value="EXPENSE">Décaissement</option>
            <option value="UPDATE">Modification</option>
            <option value="LOGIN">Connexion</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-300 bg-white"
          >
            <option value="ALL">Tous les modules</option>
            <option value="PARCEL">Colis</option>
            <option value="SHIPMENT">Expédition</option>
            <option value="PAYMENT">Paiement</option>
            <option value="EXPENSE">Dépense</option>
            <option value="CLIENT">Client</option>
            <option value="USER">Utilisateur</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date & Heure</th>
                <th className="py-3 px-4">Utilisateur / Rôle</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entité Concernée</th>
                <th className="py-3 px-4">Détails de l'Opération</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-700">
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-bold text-slate-900">{log.userName}</div>
                    <div className="text-[10px] text-slate-700">
                      {log.userRole} {log.agencyName ? `• ${log.agencyName}` : ''}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadge(
                        log.action
                      )}`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800">{log.entityType}</div>
                    <div className="text-[10px] font-mono text-slate-700">{log.entityId}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-800 font-medium">{log.details}</div>
                    {log.oldValue && log.newValue && (
                      <div className="text-[10px] text-slate-700 mt-0.5 flex items-center gap-1 font-mono">
                        <span className="line-through">{log.oldValue}</span>
                        <ArrowRight className="w-3 h-3 text-amber-500" />
                        <span className="text-emerald-700 font-bold">{log.newValue}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
