import React, { useState } from 'react';
import {
  Users,
  Search,
  PlusCircle,
  Phone,
  MapPin,
  Package,
  DollarSign,
  ArrowRight,
  Eye,
  X,
} from 'lucide-react';
import type { Client, Parcel, Payment, UserRole } from '../types/index.ts';
import { formatUSD, PUBLIC_APP_URL } from '../services/api.ts';

interface ClientsViewProps {
  clients: Client[];
  parcels: Parcel[];
  payments: Payment[];
  userRole: UserRole;
  userName: string;
  userId: string;
  onCreateClient: (data: any) => Promise<void>;
  onCreateActivationCode?: (clientId: string) => Promise<{ code: string; expiresAt: string }>;
  onSelectParcel: (parcel: Parcel) => void;
  onOpenPaymentForParcel: (parcel: Parcel) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  parcels,
  payments,
  userRole,
  userName,
  userId,
  onCreateClient,
  onCreateActivationCode,
  onSelectParcel,
  onOpenPaymentForParcel,
}) => {
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  // One-time code the agent hands to the client so they can create their account.
  const [activation, setActivation] = useState<{ clientId: string; code: string; expiresAt: string } | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isIssuingCode, setIsIssuingCode] = useState(false);

  const handleIssueActivationCode = async (client: Client) => {
    if (!onCreateActivationCode) return;
    setActivationError(null);
    setIsIssuingCode(true);
    try {
      const result = await onCreateActivationCode(client.id);
      setActivation({ clientId: client.id, ...result });
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : 'Impossible de générer le code.');
    } finally {
      setIsIssuingCode(false);
    }
  };
  const [showNewModal, setShowNewModal] = useState(false);

  // New Client Form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Kinshasa');
  const [country, setCountry] = useState('RDC');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredClients = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      !search ||
      c.fullName.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q)
    );
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateClient({
        fullName,
        phone,
        email,
        address,
        city,
        country,
        notes,
        userId,
        userName,
        userRole,
      });
      setShowNewModal(false);
      setFullName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // When client is selected, gather their parcels and payments
  const clientParcels = selectedClient
    ? parcels.filter((p) => p.clientId === selectedClient.id)
    : [];
  const clientPayments = selectedClient
    ? payments.filter((p) => p.clientId === selectedClient.id)
    : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Répertoire & Fiches Clients
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {clients.length} clients enregistrés
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Recherche rapide par nom, numéro de téléphone, historique de colis et état des créances.
          </p>
        </div>

        {userRole !== 'client' && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" /> Nouveau Client
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, code client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:outline-none"
          />
        </div>
      </div>

      {/* Grid of Clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    {client.code}
                  </span>
                  <h3 className="font-black text-slate-900 text-base mt-1">{client.fullName}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 mt-0.5 font-semibold">
                    <Phone className="w-3 h-3 text-amber-500" /> {client.phone}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-700 block uppercase font-bold">Colis</span>
                  <span className="font-black text-sm text-slate-900">
                    {client.totalParcels} colis
                  </span>
                </div>
              </div>

              <div className="mt-2 text-xs text-slate-700 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-600" />
                <span>
                  {client.city}, {client.country} {client.address ? `(${client.address})` : ''}
                </span>
              </div>

              {/* Financial overview (not sent by the API to operations teams) */}
              {client.totalPaidUSD !== undefined && (
              <div className="grid grid-cols-2 gap-2 mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] text-slate-700 block uppercase font-bold">Total Payé</span>
                  <span className="font-bold text-emerald-700">
                    {formatUSD(client.totalPaidUSD)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-700 block uppercase font-bold">Reste Dû</span>
                  <span
                    className={`font-black ${
                      client.remainingBalanceUSD > 0 ? 'text-rose-600' : 'text-slate-700'
                    }`}
                  >
                    {formatUSD(client.remainingBalanceUSD)}
                  </span>
                </div>
              </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-700">Client depuis : {client.createdAt}</span>
              <button
                onClick={() => setSelectedClient(client)}
                className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700"
              >
                Fiche complète <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Fiche Client Complète */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">
                  {selectedClient.code}
                </span>
                <h3 className="font-black text-xl text-white">{selectedClient.fullName}</h3>
                <p className="text-xs text-slate-300 mt-1">
                  📞 {selectedClient.phone} {selectedClient.email ? `• ✉️ ${selectedClient.email}` : ''} • 📍{' '}
                  {selectedClient.city}, {selectedClient.country}
                </p>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Online account: activation code for the client's self-registration */}
              {userRole !== 'client' && (
                <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50 space-y-2">
                  {selectedClient.hasAccount ? (
                    <p className="font-semibold text-indigo-900">
                      ✓ Ce client a créé son compte en ligne : il suit ses colis depuis son espace personnel.
                    </p>
                  ) : activation && activation.clientId === selectedClient.id ? (
                    <div className="space-y-1.5 text-indigo-900">
                      <p>Code d’activation à remettre au client (valable jusqu’au {new Date(activation.expiresAt).toLocaleDateString('fr-FR')}, usage unique) :</p>
                      <p className="font-mono font-black text-lg tracking-widest">{activation.code}</p>
                      <p className="text-[11px]">
                        Le client clique sur « Créer mon compte client », confirme son e-mail, puis saisit ce code et son téléphone ({selectedClient.phone}).
                      </p>
                      <a
                        href={`https://wa.me/${selectedClient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Bonjour ${selectedClient.fullName}, votre code d’activation GZ MUBUA GLOBAL est ${activation.code} (valable 7 jours). Créez votre compte sur ${PUBLIC_APP_URL} avec « Créer mon compte client ».`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                      >
                        Envoyer par WhatsApp
                      </a>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-indigo-900">
                        Pas encore de compte en ligne.{' '}
                        {selectedClient.email
                          ? 'Le client peut s’inscrire avec l’e-mail enregistré, ou avec un code.'
                          : 'Aucun e-mail enregistré : un code d’activation est nécessaire.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleIssueActivationCode(selectedClient)}
                        disabled={isIssuingCode || !onCreateActivationCode}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50"
                      >
                        {isIssuingCode ? 'Génération…' : 'Générer un code d’activation'}
                      </button>
                    </div>
                  )}
                  {activationError && <p className="text-rose-700 font-semibold">{activationError}</p>}
                </div>
              )}
              {/* Financial Summary (hidden when the API does not send balances for this role) */}
              <div className={`grid grid-cols-3 gap-3 text-center ${selectedClient.totalPaidUSD === undefined ? 'hidden' : ''}`}>
                <div className="p-3 rounded-xl bg-slate-50 border">
                  <span className="text-[10px] text-slate-400 uppercase block">Total Facturé</span>
                  <span className="font-black text-sm text-slate-900">
                    {formatUSD(selectedClient.totalAmountUSD)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 uppercase block font-bold">Total Réglé</span>
                  <span className="font-black text-sm text-emerald-700">
                    {formatUSD(selectedClient.totalPaidUSD)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-[10px] text-rose-800 uppercase block font-bold">Solde Débiteur</span>
                  <span className="font-black text-sm text-rose-600">
                    {formatUSD(selectedClient.remainingBalanceUSD)}
                  </span>
                </div>
              </div>

              {/* Parcels History */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-500" /> Historique de ses Colis ({clientParcels.length})
                </h4>
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">N° Suivi</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Poids/Vol</th>
                        <th className="p-2.5">Statut</th>
                        <th className="p-2.5">Solde Colis</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {clientParcels.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold">{p.trackingNumber}</td>
                          <td className="p-2.5 truncate max-w-[150px]">{p.description}</td>
                          <td className="p-2.5">
                            {p.weightKg} kg / {p.volumeCbm} m³
                          </td>
                          <td className="p-2.5">
                            <span className="text-[10px] font-bold text-slate-700">{p.status}</span>
                          </td>
                          <td className="p-2.5 font-bold">
                            {p.remainingAmountUSD > 0 ? (
                              <span className="text-rose-600">
                                {formatUSD(p.remainingAmountUSD)}
                              </span>
                            ) : (
                              <span className="text-emerald-600">Soldé</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => {
                                setSelectedClient(null);
                                onSelectParcel(p);
                              }}
                              className="text-amber-600 font-bold hover:underline"
                            >
                              Détails
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments History */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" /> Historique des Paiements ({clientPayments.length})
                </h4>
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">N° Reçu</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Colis</th>
                        <th className="p-2.5">Montant Original</th>
                        <th className="p-2.5">Équiv USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {clientPayments.map((pay) => (
                        <tr key={pay.id}>
                          <td className="p-2.5 font-mono font-bold">{pay.receiptNumber}</td>
                          <td className="p-2.5">{pay.date}</td>
                          <td className="p-2.5 font-mono">{pay.parcelTrackingNumber || '-'}</td>
                          <td className="p-2.5 font-bold">
                            {pay.originalAmount} {pay.currency}
                          </td>
                          <td className="p-2.5 font-bold text-emerald-700">
                            {formatUSD(pay.amountUSD)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Client */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-xs">
            <h3 className="font-black text-base text-slate-900 mb-3">Nouveau Client</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Nom Complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: David Mukendi"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Téléphone / WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: +243 81 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Email (facultatif)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Ville</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Pays</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  >
                    <option value="RDC">RDC</option>
                    <option value="Angola">Angola</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Adresse de livraison</label>
                <input
                  type="text"
                  placeholder="Commune, quartier, avenue..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Notes / Activité</label>
                <input
                  type="text"
                  placeholder="Ex: Commerçant textile..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                >
                  {isSubmitting ? 'Création...' : 'Enregistrer Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
