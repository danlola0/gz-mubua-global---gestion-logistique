import React, { useState } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  User,
  ShieldCheck,
  Calendar,
  Layers,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import type { AuditLogItem } from '../types/index.ts';

interface AuditLogsViewProps {
  logs: AuditLogItem[];
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  STATUS_CHANGE: 'Changement de statut',
  PAYMENT: 'Encaissement',
  EXPENSE: 'Décaissement',
  PERMISSION_CHANGE: 'Droits',
  LOGIN: 'Connexion',
};

const ENTITY_LABELS: Record<string, string> = {
  PARCEL: 'Colis',
  SHIPMENT: 'Expédition',
  PAYMENT: 'Paiement',
  EXPENSE: 'Dépense',
  CLIENT: 'Client',
  EMPLOYEE: 'Employé',
  USER: 'Utilisateur',
  AGENCY: 'Agence',
  SETTINGS: 'Paramètres',
  SALARY: 'Salaire',
};

const FIELD_LABELS: Record<string, string> = {
  CNY: 'Taux CNY',
  CDF: 'Taux CDF',
  AOA: 'Taux AOA',
  maritimePricePerKg: 'Tarif maritime/kg',
  aerienPricePerKg: 'Tarif aérien/kg',
  freightRateCurrency: 'Devise du tarif',
};

// old/new values are stored as JSON: plain text for status changes, full objects
// for settings updates and deletions. Never render an object directly (React crash).
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

function changedFields(oldValue: unknown, newValue: unknown) {
  if (!isPlainObject(oldValue) || !isPlainObject(newValue)) return null;
  const keys = Array.from(new Set([...Object.keys(oldValue), ...Object.keys(newValue)]));
  return keys
    .filter((key) => key !== 'lastUpdated' && asText(oldValue[key]) !== asText(newValue[key]))
    .map((key) => ({ key, before: asText(oldValue[key]), after: asText(newValue[key]) }));
}

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
};

const LogValues: React.FC<{ log: AuditLogItem }> = ({ log }) => {
  const oldValue: unknown = log.oldValue;
  const newValue: unknown = log.newValue;
  if (oldValue == null && newValue == null) return null;

  const fields = changedFields(oldValue, newValue);
  if (fields) {
    if (fields.length === 0) return null;
    return (
      <ul className="text-[10px] text-slate-700 mt-0.5 space-y-0.5 font-mono">
        {fields.map((field) => (
          <li key={field.key} className="flex flex-wrap items-center gap-1">
            <span className="font-semibold">{FIELD_LABELS[field.key] || field.key} :</span>
            <span className="line-through">{field.before || '—'}</span>
            <ArrowRight className="w-3 h-3 text-amber-500" />
            <span className="text-emerald-700 font-bold">{field.after || '—'}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (!isPlainObject(oldValue) && !isPlainObject(newValue) && !Array.isArray(oldValue) && !Array.isArray(newValue)) {
    return (
      <div className="text-[10px] text-slate-700 mt-0.5 flex flex-wrap items-center gap-1 font-mono">
        {oldValue != null && <span className="line-through">{asText(oldValue)}</span>}
        {oldValue != null && newValue != null && <ArrowRight className="w-3 h-3 text-amber-500" />}
        {newValue != null && <span className="text-emerald-700 font-bold">{asText(newValue)}</span>}
      </div>
    );
  }

  // A full record (e.g. data kept from a deletion): show it on demand.
  const snapshot = oldValue ?? newValue;
  return (
    <details className="mt-1 text-[10px] text-slate-700">
      <summary className="cursor-pointer font-semibold text-amber-700">
        {log.action === 'DELETE' ? 'Voir les données supprimées (conservées)' : 'Voir les données enregistrées'}
      </summary>
      <pre className="mt-1 max-h-64 max-w-xl overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 border border-slate-200 p-2 font-mono">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    </details>
  );
};

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      (log.userName || '').toLowerCase().includes(q) ||
      (log.details || '').toLowerCase().includes(q) ||
      (log.entityId || '').toLowerCase().includes(q);

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

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
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
            <option value="DELETE">Suppression</option>
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
            <option value="AGENCY">Agence</option>
            <option value="EMPLOYEE">Employé</option>
            <option value="SETTINGS">Paramètres</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch('');
              setActionFilter('ALL');
              setEntityFilter('ALL');
            }}
            disabled={!search && actionFilter === 'ALL' && entityFilter === 'ALL'}
            className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            title="Effacer la recherche et les filtres"
          >
            <RotateCcw className="w-3 h-3" /> Réinitialiser
          </button>
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
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    {logs.length === 0 ? 'Aucun événement enregistré pour le moment.' : 'Aucun événement ne correspond à ces filtres.'}
                  </td>
                </tr>
              )}
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition align-top">
                  <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-700">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-bold text-slate-900">{log.userName || 'Système'}</div>
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
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800">{ENTITY_LABELS[log.entityType] || log.entityType}</div>
                    <div className="text-[10px] font-mono text-slate-700">{log.entityId}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-800 font-medium">{log.details}</div>
                    <LogValues log={log} />
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
