import React, { useState } from 'react';
import {
  X,
  Package,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  Ship,
  Plane,
  DollarSign,
  Share2,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Truck,
  Building2,
  Send,
  MessageSquare,
  Trash2,
  Pencil,
} from 'lucide-react';
import type { Parcel, ParcelStatus, UserRole } from '../types/index.ts';
import { PARCEL_STATUSES } from '../types/index.ts';
import { formatUSD, formatCurrency, createWhatsAppTrackingLink } from '../services/api.ts';
import { roundMoney } from '../../supabase/functions/_shared/parcelPricing.ts';

interface ParcelDetailModalProps {
  parcel: Parcel | null;
  userRole: UserRole;
  userName: string;
  userId: string;
  userAgencyName?: string;
  onClose: () => void;
  onUpdateStatus: (
    id: string,
    params: {
      status: ParcelStatus;
      comment?: string;
      warehouseLocation?: string;
      deliveryDriverName?: string;
      deliveryDriverPhone?: string;
      deliveryRecipient?: string;
    }
  ) => Promise<void>;
  onOpenLabel: (parcel: Parcel) => void;
  onOpenPaymentForParcel: (parcel: Parcel) => void;
  onDeleteParcel?: (id: string, withPayments?: boolean) => Promise<void>;
  onUpdateParcel?: (id: string, data: Partial<Parcel>) => Promise<void>;
}

export const ParcelDetailModal: React.FC<ParcelDetailModalProps> = ({
  parcel,
  userRole,
  userName,
  userId,
  userAgencyName,
  onClose,
  onUpdateStatus,
  onOpenLabel,
  onOpenPaymentForParcel,
  onDeleteParcel,
  onUpdateParcel,
}) => {
  if (!parcel) return null;

  const [selectedStatus, setSelectedStatus] = useState<ParcelStatus>(parcel.status);
  const [comment, setComment] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState(parcel.warehouseLocation || '');
  const [deliveryDriverName, setDeliveryDriverName] = useState(parcel.deliveryDriverName || '');
  const [deliveryDriverPhone, setDeliveryDriverPhone] = useState(parcel.deliveryDriverPhone || '');
  const [deliveryRecipient, setDeliveryRecipient] = useState(parcel.deliveryRecipient || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'details' | 'photos'>('timeline');

  // Deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Parcels with cash receipts can only be deleted with an explicit opt-in.
  const hasPayments = (Number(parcel.amountPaidUSD) || 0) > 0;
  const [deleteWithPayments, setDeleteWithPayments] = useState(false);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(parcel.description);
  const [editWeight, setEditWeight] = useState(parcel.weightKg);
  const [editSupplier, setEditSupplier] = useState(parcel.supplier || '');
  const [editCost, setEditCost] = useState(parcel.transportCostUSD || 0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  // Parcels priced with the universal tariff keep their frozen per-kg rate.
  const snapshotPricePerKg = Number(parcel.pricePerKg) || 0;
  const snapshotRate = Number(parcel.pricingExchangeRate) || 1;
  const pricingCurrency = parcel.pricingCurrency || 'USD';
  const editComputedCostUSD =
    snapshotPricePerKg > 0 ? roundMoney(roundMoney((Number(editWeight) || 0) * snapshotPricePerKg) / snapshotRate) : null;

  const handleDeleteSubmit = async () => {
    if (!onDeleteParcel) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteParcel(parcel.id, deleteWithPayments);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      setDeleteError(err.message || 'Erreur lors de la suppression.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateParcel) return;
    if (!(Number(editWeight) > 0)) {
      alert('Erreur modification: le poids doit être supérieur à 0 kg.');
      return;
    }
    if (editComputedCostUSD === null && !(Number(editCost) >= 0)) {
      alert('Erreur modification: le coût de transport ne peut pas être négatif.');
      return;
    }
    setIsSavingEdit(true);
    try {
      await onUpdateParcel(parcel.id, {
        description: editDesc,
        weightKg: Number(editWeight),
        supplier: editSupplier,
        // With a frozen tariff the server recomputes the freight from the weight.
        ...(editComputedCostUSD === null ? { transportCostUSD: Number(editCost) || 0 } : {}),
      });
      setIsEditing(false);
    } catch (err: any) {
      alert(`Erreur modification: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const currentStatusCfg = PARCEL_STATUSES[parcel.status];

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStatus === parcel.status && !comment.trim() && !warehouseLocation && !deliveryDriverName) {
      return;
    }
    setIsSubmitting(true);
    setStatusError(null);
    setStatusSuccess(null);
    try {
      await onUpdateStatus(parcel.id, {
        status: selectedStatus,
        comment: comment.trim() || undefined,
        warehouseLocation: warehouseLocation.trim() || undefined,
        deliveryDriverName: deliveryDriverName.trim() || undefined,
        deliveryDriverPhone: deliveryDriverPhone.trim() || undefined,
        deliveryRecipient: deliveryRecipient.trim() || undefined,
      });
      setComment('');
      setStatusSuccess('Statut enregistré dans Supabase.');
    } catch (err: any) {
      setStatusError(err.message || 'Impossible d’enregistrer le statut. Vérifiez votre autorisation puis réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const whatsappUrl = createWhatsAppTrackingLink(parcel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex min-w-0 items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-lg tracking-wider text-amber-400">
                  {parcel.trackingNumber}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-bold border ${currentStatusCfg.badgeClass}`}
                >
                  {currentStatusCfg.label}
                </span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1">
                  {parcel.transportMode === 'MARITIME' ? (
                    <Ship className="w-3 h-3 text-blue-400" />
                  ) : (
                    <Plane className="w-3 h-3 text-sky-400" />
                  )}
                  {parcel.transportMode}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Client : <strong>{parcel.clientName}</strong> ({parcel.clientPhone}) ➔{' '}
                <span className="text-amber-300 font-semibold">{parcel.destination}</span>
              </p>
            </div>
          </div>

          <div className="flex w-full items-center justify-end gap-2 flex-wrap sm:w-auto">
            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
                  title="Modifier les caractéristiques du colis"
                >
                  <Pencil className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Modifier</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg transition"
                  title="Supprimer définitivement ce colis"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Supprimer</span>
                </button>
              </>
            )}
            <button
              onClick={() => onOpenLabel(parcel)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
              title="Générer l'étiquette de colis"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Étiquette</span>
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition shadow-sm"
              title="Envoyer le suivi au client par WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" /> WhatsApp
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 sm:px-4">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`shrink-0 whitespace-nowrap py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'timeline'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Chronologie du Suivi ({parcel.statusHistory.length} étapes)
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`shrink-0 whitespace-nowrap py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'details'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Caractéristiques & Financier
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`shrink-0 whitespace-nowrap py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'photos'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Photos du Colis ({parcel.photos.length})
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              {/* Status Update Form (Staff only) */}
              {userRole !== 'client' && (
                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5" /> Mettre à jour le statut du colis
                  </h4>
                  <form onSubmit={handleStatusSubmit} className="space-y-3">
                    {statusError && (
                      <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {statusError}
                      </p>
                    )}
                    {statusSuccess && (
                      <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        {statusSuccess}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Nouveau statut officiel (17 statuts)
                        </label>
                        <select
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value as ParcelStatus)}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500"
                        >
                          {Object.values(PARCEL_STATUSES).map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Contextual fields based on status */}
                      {(selectedStatus === 'DISPONIBLE_AGENCE' ||
                        selectedStatus === 'DEDOUANEMENT_TRAITEMENT') && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Emplacement de Stockage (Hangar / Rayon)
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Rayon B-14, Dépôt Limete"
                            value={warehouseLocation}
                            onChange={(e) => setWarehouseLocation(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                      )}

                      {(selectedStatus === 'PREPARATION_LIVRAISON' ||
                        selectedStatus === 'EN_COURS_LIVRAISON') && (
                        <>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Nom du Livreur / Chauffeur
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: Christian Bakole"
                              value={deliveryDriverName}
                              onChange={(e) => setDeliveryDriverName(e.target.value)}
                              className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Téléphone du Livreur
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: +243 81 777 6655"
                              value={deliveryDriverPhone}
                              onChange={(e) => setDeliveryDriverPhone(e.target.value)}
                              className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                            />
                          </div>
                        </>
                      )}

                      {(selectedStatus === 'LIVRE' || selectedStatus === 'RETIRE_CLIENT') && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Bénéficiaire / Réceptionnaire final
                          </label>
                          <input
                            type="text"
                            placeholder="Nom de la personne ayant réceptionné"
                            value={deliveryRecipient}
                            onChange={(e) => setDeliveryRecipient(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Commentaire / Note d’opération
                      </label>
                      <input
                        type="text"
                        placeholder="Préciser les détails de l'opération (ex: déchargé au port, contrôlé en bon état, etc.)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isSubmitting ? 'Enregistrement...' : 'Valider ce statut'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Status History Timeline */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Historique chronologique des
                  opérations
                </h4>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {parcel.statusHistory.map((item, index) => {
                    const cfg = PARCEL_STATUSES[item.status];
                    const isLatest = index === parcel.statusHistory.length - 1;
                    return (
                      <div key={item.id} className="relative group">
                        <div
                          className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-white transition ${
                            isLatest
                              ? 'border-amber-500 bg-amber-500 ring-4 ring-amber-100'
                              : 'border-slate-400'
                          }`}
                        />
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                                cfg?.badgeClass || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {cfg?.label || item.status}
                            </span>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2">
                              <span>
                                {item.date} à {item.time}
                              </span>
                              {item.user && (
                                <span className="text-slate-600 font-medium">
                                  Par : {item.user}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.comment && (
                            <p className="text-xs text-slate-700 mt-1.5">{item.comment}</p>
                          )}
                          {item.agency && (
                            <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-600" /> {item.agency}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product & Freight Information */}
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                    Description & Colisage
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Description</span>
                      <p className="font-semibold text-slate-900">{parcel.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Quantité de colis</span>
                        <p className="font-semibold text-slate-900">{parcel.quantity} colis</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Poids total pesé</span>
                        <p className="font-semibold text-slate-900">{parcel.weightKg} kg</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Dimensions (L x l x h)</span>
                        <p className="font-semibold text-slate-900">
                          {parcel.lengthCm || 0} x {parcel.widthCm || 0} x {parcel.heightCm || 0} cm
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Volume cubique</span>
                        <p className="font-semibold text-slate-900">{parcel.volumeCbm} m³ (CBM)</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                    Achat & Entrepôt Chine
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Fournisseur / Vendeur</span>
                      <p className="font-semibold text-slate-900">{parcel.supplier}</p>
                    </div>
                    {parcel.purchaseInfo && (
                      <div>
                        <span className="text-slate-400 block text-[10px]">Informations d'Achat</span>
                        <p className="text-slate-700">{parcel.purchaseInfo}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400 block text-[10px]">Point de Réception Chine</span>
                      <p className="text-slate-700">{parcel.chinaReceptionAddress}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Routing & Financials */}
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                    Itinéraire & Expédition Associée
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Origine :</span>
                      <span className="font-semibold text-slate-800">{parcel.origin}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Destination :</span>
                      <span className="font-semibold text-amber-700">{parcel.destination}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mode de transport :</span>
                      <span className="font-semibold text-slate-800">{parcel.transportMode}</span>
                    </div>
                    {parcel.shipmentNumber && (
                      <div className="flex justify-between pt-2 border-t border-slate-200">
                        <span className="text-slate-400">N° d'Expédition Fret :</span>
                        <span className="font-mono font-bold text-blue-700">
                          {parcel.shipmentNumber}
                        </span>
                      </div>
                    )}
                    {parcel.warehouseLocation && (
                      <div className="flex justify-between pt-2 border-t border-slate-200">
                        <span className="text-slate-400">Emplacement dépôt :</span>
                        <span className="font-semibold text-slate-900">
                          {parcel.warehouseLocation}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial overview */}
                <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Règlement & Solde
                    </h4>
                    {parcel.remainingAmountUSD > 0 && userRole !== 'client' && (
                      <button
                        onClick={() => onOpenPaymentForParcel(parcel)}
                        className="text-[11px] font-bold text-amber-900 bg-amber-400 hover:bg-amber-300 px-2 py-1 rounded transition"
                      >
                        Encaisser un acompte / solde
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    {snapshotPricePerKg > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Tarif appliqué ({parcel.transportMode === 'AERIEN' ? 'aérien' : 'maritime'}) :</span>
                        <span className="font-semibold text-slate-900">
                          {parcel.weightKg} kg × {formatCurrency(snapshotPricePerKg, pricingCurrency)}/kg
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-600">Frais de transport fret :</span>
                      <span className="font-semibold text-slate-900">
                        {formatUSD(parcel.transportCostUSD)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Frais annexes (douane, manutention) :</span>
                      <span className="font-semibold text-slate-900">
                        {formatUSD(parcel.extraFeesUSD)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-amber-200/80 font-bold">
                      <span className="text-slate-900">Coût Total Facturé :</span>
                      <span className="text-slate-900">
                        {formatUSD(parcel.totalCostUSD)}
                        {pricingCurrency !== 'USD' && parcel.totalAmount != null && (
                          <span className="text-slate-500 font-semibold"> ({formatCurrency(Number(parcel.totalAmount), pricingCurrency)})</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Montant Payé par le client :</span>
                      <span>{formatUSD(parcel.amountPaidUSD)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-amber-200/80 font-black text-sm">
                      <span className="text-slate-900">Reste à Payer :</span>
                      <span
                        className={
                          parcel.remainingAmountUSD > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }
                      >
                        {formatUSD(parcel.remainingAmountUSD)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'photos' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-500">
                  Photos prises lors de la réception et du contrôle qualité à l’entrepôt en Chine.
                </p>
              </div>

              {parcel.photos.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                  Aucune photo importée pour ce colis.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {parcel.photos.map((photo, i) => (
                    <div
                      key={i}
                      className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 group relative"
                    >
                      <img
                        src={photo}
                        alt={`Photo colis ${i + 1}`}
                        className="w-full h-48 sm:h-56 object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="p-2 bg-slate-900/90 text-[11px] text-white flex justify-between">
                        <span>Photo contrôle #{i + 1}</span>
                        <a
                          href={photo}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-400 hover:underline"
                        >
                          Agrandir
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 p-4 sm:p-6 max-w-md w-full max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Suppression Définitive</h3>
                <p className="text-xs text-slate-500 font-mono">{parcel.trackingNumber}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement ce colis ?
              Cette action est <strong>irréversible</strong> et supprimera réellement l'enregistrement
              dans votre base de données Supabase PostgreSQL.
            </p>

            {hasPayments && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-2">
                <p>
                  Ce colis a déjà <strong>{formatUSD(parcel.amountPaidUSD)}</strong> encaissés. Pour le supprimer,
                  ses reçus de paiement doivent être supprimés avec lui (ils disparaîtront de la caisse ; le
                  détail reste dans le journal d’audit).
                </p>
                <label className="flex items-start gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteWithPayments}
                    onChange={(e) => setDeleteWithPayments(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-rose-600"
                  />
                  Supprimer aussi les reçus de paiement de ce colis
                </label>
              </div>
            )}

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                  setDeleteWithPayments(false);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isDeleting || (hasPayments && !deleteWithPayments)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Parcel Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleEditSave}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-6 max-w-lg w-full max-h-[92vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2 min-w-0 break-all">
                <Pencil className="w-4 h-4 shrink-0 text-amber-500" /> Modifier le Colis ({parcel.trackingNumber})
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description marchandise</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full p-2 border rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Poids réel (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editWeight}
                    onChange={(e) => setEditWeight(Number(e.target.value))}
                    className="w-full p-2 border rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Coût transport ($)</label>
                  {editComputedCostUSD !== null ? (
                    <input
                      type="text"
                      readOnly
                      value={formatUSD(editComputedCostUSD)}
                      title={`Tarif figé : ${formatCurrency(snapshotPricePerKg, pricingCurrency)}/kg`}
                      className="w-full p-2 border rounded-xl bg-slate-100"
                    />
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editCost}
                      onChange={(e) => setEditCost(Number(e.target.value))}
                      className="w-full p-2 border rounded-xl"
                      required
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fournisseur / Expéditeur Chine</label>
                <input
                  type="text"
                  value={editSupplier}
                  onChange={(e) => setEditSupplier(e.target.value)}
                  className="w-full p-2 border rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl"
              >
                {isSavingEdit ? 'Enregistrement...' : 'Enregistrer dans Supabase'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
