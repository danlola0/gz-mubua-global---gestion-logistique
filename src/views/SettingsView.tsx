import React, { useState } from 'react';
import {
  Settings,
  Globe,
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Plus,
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
  onCreateAgency: (agencyData: Partial<Agency>) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  exchangeRates,
  agencies,
  users,
  onUpdateRates,
  onCreateUser,
  onCreateAgency,
}) => {
  const emptyAgency = {
    name: '',
    country: 'Chine' as Agency['country'],
    city: '',
    type: 'origin' as Agency['type'],
    address: '',
    phone: '',
    email: '',
    managerName: '',
  };
  const [showAgencyForm, setShowAgencyForm] = useState(false);
  const [agencyForm, setAgencyForm] = useState(emptyAgency);
  const [isCreatingAgency, setIsCreatingAgency] = useState(false);
  const [agencyError, setAgencyError] = useState<string | null>(null);
  const [agencySuccess, setAgencySuccess] = useState<string | null>(null);

  const handleAgencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAgencyError(null);
    setAgencySuccess(null);
    setIsCreatingAgency(true);
    try {
      await onCreateAgency(agencyForm);
      setAgencySuccess(`Agence « ${agencyForm.name} » créée.`);
      setAgencyForm(emptyAgency);
      setShowAgencyForm(false);
    } catch (err) {
      setAgencyError(err instanceof Error ? err.message : 'Création de l’agence impossible.');
    } finally {
      setIsCreatingAgency(false);
    }
  };

  const [rates, setRates] = useState({
    CNY: exchangeRates.CNY,
    CDF: exchangeRates.CDF,
    AOA: exchangeRates.AOA,
  });
  const [freight, setFreight] = useState({
    maritimePricePerCbm: exchangeRates.maritimePricePerCbm || 0,
    aerienPricePerKg: exchangeRates.aerienPricePerKg || 0,
    freightRateCurrency: (exchangeRates.freightRateCurrency || 'USD') as Currency,
  });
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);
  const [rateSuccess, setRateSuccess] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  // New user form state
  const [showUserModal, setShowUserModal] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Agencies an operational role may be attached to (mirrors the API rule).
  const agenciesForRole = (r: UserRole) =>
    r === 'china_team'
      ? agencies.filter((a) => a.country === 'Chine')
      : r === 'kinshasa_team'
        ? agencies.filter((a) => a.country === 'RDC' || a.country === 'Angola')
        : agencies;
  const [role, setRole] = useState<UserRole>('kinshasa_team');
  const [agencyId, setAgencyId] = useState(agenciesForRole('kinshasa_team')[0]?.id || '');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);


  const handleRatesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateSuccess(false);
    setRateError(null);
    if ([freight.maritimePricePerCbm, freight.aerienPricePerKg].some((v) => !Number.isFinite(Number(v)) || Number(v) < 0)) {
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
        maritimePricePerCbm: Number(freight.maritimePricePerCbm),
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
    setUserError(null);
    if (role !== 'admin' && !agencyId) {
      setUserError('Une agence compatible avec ce rôle est obligatoire.');
      return;
    }
    setIsCreatingUser(true);
    try {
      // The agency name is taken from Supabase by the API, not from the form.
      await onCreateUser({
        username,
        fullName,
        email,
        phone,
        role,
        agencyId: agencyId || undefined,
        status: 'active',
      });
      setShowUserModal(false);
      setUsername('');
      setFullName('');
      setEmail('');
      setPhone('');
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Création du compte impossible.');
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
            Taux de change (USD, CNY, CDF, AOA), tarif du fret, agences et utilisateurs.
          </p>
        </div>
      </div>


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
                Tarifs du fret
              </label>
              <p className="text-[10px] text-slate-500">
                Aérien : facturé au poids (kg). Maritime : facturé au volume (CBM = m³). Appliqués aux nouveaux colis uniquement ; les colis déjà enregistrés conservent leur tarif.
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
                  value={freight.maritimePricePerCbm}
                  onChange={(e) => setFreight({ ...freight, maritimePricePerCbm: Number(e.target.value) })}
                  className="w-32 p-2 rounded-lg border border-slate-300 font-mono font-bold bg-white"
                />
                <span className="text-slate-700 font-bold">{freight.freightRateCurrency} / CBM (m³)</span>
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
            {!showAgencyForm && (
              <button
                type="button"
                onClick={() => {
                  setShowAgencyForm(true);
                  setAgencySuccess(null);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            )}
          </div>

          {agencySuccess && (
            <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {agencySuccess}
            </p>
          )}

          {showAgencyForm && (
            <form onSubmit={handleAgencySubmit} className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Nom de l’agence *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : GZ MUBUA Hub Guangzhou"
                    value={agencyForm.name}
                    onChange={(e) => setAgencyForm({ ...agencyForm, name: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Pays *</label>
                  <select
                    value={agencyForm.country}
                    onChange={(e) => {
                      const country = e.target.value as Agency['country'];
                      setAgencyForm({ ...agencyForm, country, type: country === 'Chine' ? 'origin' : 'destination' });
                    }}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Chine">Chine</option>
                    <option value="RDC">RDC</option>
                    <option value="Angola">Angola</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Ville *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : Guangzhou"
                    value={agencyForm.city}
                    onChange={(e) => setAgencyForm({ ...agencyForm, city: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Rôle</label>
                  <select
                    value={agencyForm.type}
                    onChange={(e) => setAgencyForm({ ...agencyForm, type: e.target.value as Agency['type'] })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="origin">Origine (réception Chine)</option>
                    <option value="destination">Destination (retrait client)</option>
                    <option value="hub">Hub</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={agencyForm.phone}
                    onChange={(e) => setAgencyForm({ ...agencyForm, phone: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Adresse</label>
                  <input
                    type="text"
                    value={agencyForm.address}
                    onChange={(e) => setAgencyForm({ ...agencyForm, address: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={agencyForm.email}
                    onChange={(e) => setAgencyForm({ ...agencyForm, email: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Responsable</label>
                  <input
                    type="text"
                    value={agencyForm.managerName}
                    onChange={(e) => setAgencyForm({ ...agencyForm, managerName: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              {agencyError && (
                <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {agencyError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAgencyForm(false);
                    setAgencyError(null);
                  }}
                  className="px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAgency}
                  className="px-4 py-2 font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition disabled:opacity-50"
                >
                  {isCreatingAgency ? 'Création...' : 'Créer l’agence'}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {agencies.map((a) => (
              <div key={a.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{a.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-800">
                    {a.country}
                  </span>
                </div>
                <p className="text-slate-600 mt-1">{[a.city, a.address].filter(Boolean).join(' • ')}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
                  <span>Tél : {a.phone || '—'}</span>
                  <span>Resp : {a.managerName || '—'}</span>
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
                    required
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setRole(nextRole);
                      const first = agenciesForRole(nextRole)[0];
                      setAgencyId(nextRole === 'admin' ? '' : first?.id || '');
                    }}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  >
                    <option value="admin">Administrateur général</option>
                    <option value="china_team">Équipe Chine</option>
                    <option value="kinshasa_team">Équipe Kinshasa / destination</option>
                    <option value="cashier">Caissier</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    Agence {role === 'admin' ? '(facultatif)' : '*'}
                  </label>
                  <select
                    value={agencyId}
                    required={role !== 'admin'}
                    onChange={(e) => setAgencyId(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  >
                    {role === 'admin' && <option value="">Toutes les agences</option>}
                    {role !== 'admin' && agenciesForRole(role).length === 0 && (
                      <option value="">Aucune agence compatible : créez-la d’abord</option>
                    )}
                    {agenciesForRole(role).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.country})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {role === 'admin' && 'Accès à toutes les agences, tableaux de bord et paramètres.'}
                {role === 'china_team' && 'Accès uniquement aux colis et expéditions de l’agence chinoise choisie.'}
                {role === 'kinshasa_team' && 'Accès uniquement aux colis et expéditions destinés à l’agence choisie.'}
                {role === 'cashier' && 'Accès uniquement à la caisse et aux dépenses de l’agence choisie.'}
                {' '}Les clients créent eux-mêmes leur compte (« Créer mon compte client »).
              </p>
              {userError && (
                <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-rose-700">
                  {userError}
                </p>
              )}
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
