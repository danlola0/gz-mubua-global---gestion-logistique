import React, { useState, useEffect } from 'react';
import {
  Settings,
  Globe,
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Plus,
  Database,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertCircle,
  FileCode,
  Check,
  Ship,
  Plane,
} from 'lucide-react';
import type { ExchangeRates, Agency, User, UserRole, Currency } from '../types/index.ts';
import { api } from '../services/api.ts';

interface SettingsViewProps {
  exchangeRates: ExchangeRates;
  agencies: Agency[];
  users: User[];
  onUpdateRates: (rates: Partial<ExchangeRates>) => Promise<void>;
  onCreateUser: (userData: Partial<User>) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  exchangeRates,
  agencies,
  users,
  onUpdateRates,
  onCreateUser,
}) => {
  const [rates, setRates] = useState({
    CNY: exchangeRates.CNY,
    CDF: exchangeRates.CDF,
    AOA: exchangeRates.AOA,
  });
  const [freight, setFreight] = useState({
    maritimePricePerKg: exchangeRates.maritimePricePerKg || 0,
    aerienPricePerKg: exchangeRates.aerienPricePerKg || 0,
    freightRateCurrency: (exchangeRates.freightRateCurrency || 'USD') as Currency,
  });
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);
  const [rateSuccess, setRateSuccess] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  // Supabase Integration state
  const [supabaseStatus, setSupabaseStatus] = useState<{
    isConfigured: boolean;
    url: string | null;
    message: string;
  }>({
    isConfigured: false,
    url: null,
    message: 'Chargement...',
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; tablesStatus?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // New user form state
  const [showUserModal, setShowUserModal] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('kinshasa_team');
  const [agencyId, setAgencyId] = useState(agencies[0]?.id || 'AG-GOMBE');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  useEffect(() => {
    loadSupabaseInfo();
  }, []);

  const loadSupabaseInfo = async () => {
    try {
      const status = await api.getSupabaseStatus();
      setSupabaseStatus(status);
    } catch (err) {
      console.error('Error fetching Supabase status:', err);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.testSupabase();
      setTestResult(res);
      await loadSupabaseInfo();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsTesting(false);
    }
  };


  const handleRatesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateSuccess(false);
    setRateError(null);
    if ([freight.maritimePricePerKg, freight.aerienPricePerKg].some((v) => !Number.isFinite(Number(v)) || Number(v) < 0)) {
      setRateError('Les tarifs par kg doivent être des nombres positifs ou nuls.');
      return;
    }
    setIsUpdatingRates(true);
    try {
      await onUpdateRates({
        USD: 1,
        CNY: Number(rates.CNY),
        CDF: Number(rates.CDF),
        AOA: Number(rates.AOA),
        maritimePricePerKg: Number(freight.maritimePricePerKg),
        aerienPricePerKg: Number(freight.aerienPricePerKg),
        freightRateCurrency: freight.freightRateCurrency,
      });
      setRateSuccess(true);
      setTimeout(() => setRateSuccess(false), 3000);
    } catch (err) {
      setRateError(err instanceof Error ? err.message : 'Échec de la mise à jour des taux.');
    } finally {
      setIsUpdatingRates(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const agency = agencies.find((a) => a.id === agencyId);
    setIsCreatingUser(true);
    try {
      await onCreateUser({
        username,
        fullName,
        email,
        phone,
        role,
        agencyId,
        agencyName: agency?.name || 'Siège Kinshasa Gombe',
        status: 'active',
      });
      setShowUserModal(false);
      setUsername('');
      setFullName('');
      setEmail('');
      setPhone('');
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" /> Paramètres Système & Intégrations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Connexion PostgreSQL Supabase, gestion des devises (USD, CNY, CDF, AOA), hubs et habilitations RBAC.
          </p>
        </div>
      </div>

        {/* Supabase Edge Function status */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-black">Supabase PostgreSQL + Edge Functions</h2>
              <p className="mt-1 text-xs text-slate-300">
                {supabaseStatus.url ? `Projet : ${supabaseStatus.url}` : 'État de la passerelle Supabase'}
              </p>
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${supabaseStatus.isConfigured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                {supabaseStatus.isConfigured ? 'Edge API configurée' : 'Edge API indisponible'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Vérification…' : 'Tester Supabase'}
          </button>
        </div>
        {testResult && (
          <p role="status" className={`mt-4 rounded-xl border p-3 text-xs ${testResult.success ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200' : 'border-rose-500/40 bg-rose-950/40 text-rose-200'}`}>
            {testResult.message}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Multi-currency Rates */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" /> Taux de Change du Jour (Base : 1 USD)
            </h2>
            <span className="text-[10px] text-slate-400">
              Dernière mise à jour : {exchangeRates.lastUpdated}
            </span>
          </div>

          <form onSubmit={handleRatesSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Yuan Chinois (CNY / RMB ¥)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">1 USD =</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={rates.CNY}
                  onChange={(e) => setRates({ ...rates, CNY: Number(e.target.value) })}
                  className="w-32 p-2 rounded-lg border border-slate-300 font-mono font-bold bg-white"
                />
                <span className="text-slate-700 font-bold">¥ (RMB)</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Franc Congolais (CDF FC)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">1 USD =</span>
                <input
                  type="number"
                  step="1"
                  required
                  value={rates.CDF}
                  onChange={(e) => setRates({ ...rates, CDF: Number(e.target.value) })}
                  className="w-32 p-2 rounded-lg border border-slate-300 font-mono font-bold bg-white"
                />
                <span className="text-slate-700 font-bold">FC (Kinshasa)</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Kwanza Angolais (AOA Kz)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">1 USD =</span>
                <input
                  type="number"
                  step="1"
                  required
                  value={rates.AOA}
                  onChange={(e) => setRates({ ...rates, AOA: Number(e.target.value) })}
                  className="w-32 p-2 rounded-lg border border-slate-300 font-mono font-bold bg-white"
                />
                <span className="text-slate-700 font-bold">Kz (Luanda)</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
              <label className="block text-[11px] font-bold text-slate-700">
                Tarif Fret Universel (par kg)
              </label>
              <p className="text-[10px] text-slate-500">
                Appliqué aux nouveaux colis uniquement. Les colis déjà enregistrés conservent leur tarif.
              </p>
              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-700 font-bold flex items-center gap-1">
                  <Ship className="w-3.5 h-3.5 text-blue-600" /> Maritime
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={freight.maritimePricePerKg}
                  onChange={(e) => setFreight({ ...freight, maritimePricePerKg: Number(e.target.value) })}
                  className="w-32 p-2 rounded-lg border border-slate-300 font-mono font-bold bg-white"
                />
                <span className="text-slate-700 font-bold">{freight.freightRateCurrency} / kg</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-700 font-bold flex items-center gap-1">
                  <Plane className="w-3.5 h-3.5 text-sky-600" /> Aérien
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={freight.aerienPricePerKg}
                  onChange={(e) => setFreight({ ...freight, aerienPricePerKg: Number(e.target.value) })}
                  className="w-32 p-2 rounded-lg border border-slate-300 font-mono font-bold bg-white"
                />
                <span className="text-slate-700 font-bold">{freight.freightRateCurrency} / kg</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-700 font-bold">Devise</span>
                <select
                  value={freight.freightRateCurrency}
                  onChange={(e) => setFreight({ ...freight, freightRateCurrency: e.target.value as Currency })}
                  className="w-32 p-2 rounded-lg border border-slate-300 font-bold bg-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="CDF">CDF (FC)</option>
                  <option value="CNY">CNY (¥)</option>
                  <option value="AOA">AOA (Kz)</option>
                </select>
              </div>
            </div>

            {rateError && (
              <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {rateError}
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              {rateSuccess ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Taux mis à jour avec succès !
                </span>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={isUpdatingRates}
                className="px-4 py-2 font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition disabled:opacity-50"
              >
                {isUpdatingRates ? 'Mise à jour...' : 'Sauvegarder les Taux'}
              </button>
            </div>
          </form>
        </div>

        {/* 2. Agencies */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-600" /> Réseau d'Agences & Hubs ({agencies.length})
            </h2>
          </div>

          <div className="space-y-3">
            {agencies.map((a) => (
              <div key={a.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{a.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-800">
                    {a.country}
                  </span>
                </div>
                <p className="text-slate-600 mt-1">{a.address}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Tél : {a.phone}</span>
                  <span>Resp : {a.managerName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Utilisateurs & Rôles (RBAC) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Utilisateurs & Permissions (RBAC)
            </h2>
            <p className="text-xs text-slate-500">
              Contrôle d'accès basé sur les rôles pour chaque agence et fonction.
            </p>
          </div>
          <button
            onClick={() => setShowUserModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" /> Créer un Utilisateur
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Identifiant</th>
                <th className="py-2.5 px-3">Nom Complet</th>
                <th className="py-2.5 px-3">Rôle Système</th>
                <th className="py-2.5 px-3">Agence Attribuée</th>
                <th className="py-2.5 px-3">Contact</th>
                <th className="py-2.5 px-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{u.username}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{u.fullName}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{u.agencyName}</td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {u.phone} • {u.email}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-[10px] font-bold text-emerald-600">Actif ✓</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New User */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-xs">
            <h3 className="font-bold text-base text-slate-900 mb-3">Nouvel Utilisateur</h3>
            <form onSubmit={handleUserSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Identifiant de connexion *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: agent_luanda"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Nom Complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mateus Dos Santos"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Téléphone *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: +244 923 000 000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Rôle</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  >
                    <option value="admin">Administrateur</option>
                    <option value="china_team">Équipe Chine</option>
                    <option value="kinshasa_team">Équipe Kinshasa</option>
                    <option value="cashier">Caissier</option>
                    <option value="client">Client</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Agence</label>
                  <select
                    value={agencyId}
                    onChange={(e) => setAgencyId(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  >
                    {agencies.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-4 py-2 font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                >
                  Créer Compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
