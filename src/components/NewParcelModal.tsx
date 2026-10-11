import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Package,
  User,
  Phone,
  Scale,
  Box,
  Ship,
  Plane,
  DollarSign,
  Plus,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { Client, TransportMode, Currency, Agency, ExchangeRates } from '../types/index.ts';
import { api, formatCurrency } from '../services/api.ts';
import { compressImageFile } from '../services/imageUpload.ts';
import { computeParcelPricing, currencyRate } from '../../supabase/functions/_shared/parcelPricing.ts';

interface NewParcelModalProps {
  clients: Client[];
  agencies: Agency[];
  exchangeRates: ExchangeRates;
  onClose: () => void;
  onCreateParcel: (data: any) => Promise<void>;
  userName: string;
  userId: string;
  userRole: string;
}

export const NewParcelModal: React.FC<NewParcelModalProps> = ({
  clients,
  agencies,
  exchangeRates,
  onClose,
  onCreateParcel,
  userName,
  userId,
  userRole,
}) => {
  const [clientId, setClientId] = useState(clients[0]?.id || 'NEW');
  const [clientName, setClientName] = useState(clients[0]?.fullName || '');
  const [clientPhone, setClientPhone] = useState(clients[0]?.phone || '');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [lengthCm, setLengthCm] = useState<number | ''>('');
  const [widthCm, setWidthCm] = useState<number | ''>('');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [volumeCbm, setVolumeCbm] = useState<number | ''>('');
  const [transportMode, setTransportMode] = useState<TransportMode>('MARITIME');
  const [destination, setDestination] = useState('Kinshasa');
  // Only real agencies can be referenced (parcels.china_agency_id is a foreign key).
  const chinaAgencies = agencies.filter((a) => a.country === 'Chine' || a.type !== 'destination');
  const [chinaAgencyId, setChinaAgencyId] = useState(chinaAgencies[0]?.id || '');
  const [chinaReceptionAddress, setChinaReceptionAddress] = useState(
    'Entrepôt GZ MUBUA Hub Guangzhou, Quai 03'
  );
  const [supplier, setSupplier] = useState('');
  const [purchaseInfo, setPurchaseInfo] = useState('');
  // Amounts below are expressed in the tariff currency (pricingCurrency).
  const [transportCost, setTransportCost] = useState<number | ''>('');
  const [extraFees, setExtraFees] = useState<number | ''>(0);
  const [amountPaid, setAmountPaid] = useState<number | ''>(0);
  const [paymentMethod, setPaymentMethod] = useState('ESPECES');
  const MAX_PHOTOS = 10;
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Universal per-kg tariff configured by the admin; 0 means manual pricing.
  const pricingCurrency: Currency = exchangeRates.freightRateCurrency || 'USD';
  const pricePerKg =
    (transportMode === 'AERIEN' ? exchangeRates.aerienPricePerKg : exchangeRates.maritimePricePerKg) || 0;
  const hasTariff = pricePerKg > 0;
  const pricing = useMemo(
    () =>
      computeParcelPricing({
        weightKg: Number(weightKg),
        pricePerKg,
        manualFreightAmount: Number(transportCost) || 0,
        extraFees: Number(extraFees) || 0,
        amountPaid: Number(amountPaid) || 0,
        currency: pricingCurrency,
        exchangeRate: currencyRate(pricingCurrency, exchangeRates),
      }),
    [weightKg, pricePerKg, transportCost, extraFees, amountPaid, pricingCurrency, exchangeRates]
  );
  const money = (amount: number) => formatCurrency(amount, pricingCurrency);

  // Auto calculate volume in CBM whenever L, W, H change
  useEffect(() => {
    const l = Number(lengthCm);
    const w = Number(widthCm);
    const h = Number(heightCm);
    if (l > 0 && w > 0 && h > 0) {
      const cbm = (l * w * h) / 1000000;
      setVolumeCbm(Number(cbm.toFixed(3)));
    }
  }, [lengthCm, widthCm, heightCm]);

  // When client changes from dropdown
  const handleClientSelect = (id: string) => {
    setClientId(id);
    if (id === 'NEW') {
      setClientName('');
      setClientPhone('');
    } else {
      const selected = clients.find((c) => c.id === id);
      if (selected) {
        setClientName(selected.fullName);
        setClientPhone(selected.phone);
      }
    }
  };

  // Compress then upload each picked file to Supabase Storage; keep the public URLs.
  const handlePhotoFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length - uploadingCount;
    if (room <= 0) {
      setPhotoError(`Maximum ${MAX_PHOTOS} photos par colis.`);
      return;
    }
    const accepted = files.slice(0, room);
    const errors: string[] = [];
    if (files.length > room) errors.push(`Seules ${room} photo(s) ajoutée(s) : maximum ${MAX_PHOTOS} par colis.`);
    setUploadingCount((n) => n + accepted.length);
    await Promise.all(
      accepted.map(async (file) => {
        try {
          const dataUrl = await compressImageFile(file);
          const url = await api.uploadParcelPhoto(dataUrl);
          setPhotos((prev) => [...prev, url]);
        } catch (err) {
          errors.push(err instanceof Error ? err.message : `Échec de l’envoi de « ${file.name} ».`);
        } finally {
          setUploadingCount((n) => n - 1);
        }
      })
    );
    if (errors.length > 0) setPhotoError(errors.join(' '));
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!clientName.trim() || !clientPhone.trim() || !description.trim() || !weightKg) {
      setSubmitError('Veuillez remplir le nom du client, le téléphone, la description et le poids.');
      return;
    }
    if (!pricing.ok) {
      setSubmitError(pricing.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const chinaAgency = agencies.find((a) => a.id === chinaAgencyId);
      await onCreateParcel({
        clientId: clientId === 'NEW' ? null : clientId,
        clientName,
        clientPhone,
        description,
        quantity: Number(quantity) || 1,
        weightKg: Number(weightKg),
        lengthCm: lengthCm ? Number(lengthCm) : undefined,
        widthCm: widthCm ? Number(widthCm) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        volumeCbm: volumeCbm ? Number(volumeCbm) : 0.05,
        photos,
        supplier: supplier || 'Fournisseur Chine',
        purchaseInfo,
        chinaReceptionAddress,
        chinaAgencyId: chinaAgencyId || null,
        chinaAgencyName: chinaAgency?.name || '',
        transportMode,
        destination,
        destinationAgencyName:
          destination === 'Angola' ? 'Agence Luanda Viana' : 'Dépôt & Retrait Kinshasa Limete',
        // The server recomputes the price; these let it detect a tariff change meanwhile.
        pricingCurrency,
        appliedPricePerKg: pricePerKg,
        transportCost: hasTariff ? 0 : Number(transportCost) || 0,
        extraFees: Number(extraFees) || 0,
        amountPaid: Number(amountPaid) || 0,
        paymentMethod,
        userName,
        userId,
        userRole,
      });
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? `Échec de l’enregistrement : ${err.message}`
          : 'Échec de l’enregistrement du colis. Vérifiez la connexion puis réessayez.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">
                Enregistrer un Nouveau Colis (Chine)
              </h3>
              <p className="text-xs text-slate-300">
                Génération automatique du numéro de suivi unique (COL-2026-XXXXXX)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* 1. Client Information */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-500" /> Informations Client
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Sélectionner un Client existant
                </label>
                <select
                  value={clientId}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="NEW">+ Nouveau Client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nom Complet du Client *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Patrice Ilunga"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Téléphone / WhatsApp *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: +243 81 234 5678"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>

          {/* 2. Merchandise details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
              <Box className="w-4 h-4 text-amber-500" /> Détails Marchandise & Poids
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Description détaillée des articles *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Rouleaux de tissus wax synthétique, 12 ballots"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Quantité de colis
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Poids réel (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Ex: 85"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Dimensions (L x l x h cm)
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    <input
                      type="number"
                      placeholder="L"
                      value={lengthCm}
                      onChange={(e) =>
                        setLengthCm(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="text-xs p-2 rounded-lg border border-slate-300 bg-white text-center"
                    />
                    <input
                      type="number"
                      placeholder="l"
                      value={widthCm}
                      onChange={(e) =>
                        setWidthCm(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="text-xs p-2 rounded-lg border border-slate-300 bg-white text-center"
                    />
                    <input
                      type="number"
                      placeholder="h"
                      value={heightCm}
                      onChange={(e) =>
                        setHeightCm(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="text-xs p-2 rounded-lg border border-slate-300 bg-white text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Volume cubique (m³ CBM)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Ex: 0.54"
                    value={volumeCbm}
                    onChange={(e) =>
                      setVolumeCbm(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-amber-50 font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Routing & Reception in China */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
              <Ship className="w-4 h-4 text-amber-500" /> Expédition, Acheminement & Réception Chine
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Mode de Transport Fret
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransportMode('MARITIME')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      transportMode === 'MARITIME'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <Ship className="w-3.5 h-3.5" /> Maritime
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransportMode('AERIEN')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      transportMode === 'AERIEN'
                        ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <Plane className="w-3.5 h-3.5" /> Aérien
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Destination Finale
                </label>
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Kinshasa">Kinshasa (RDC) - Principal</option>
                  <option value="Angola">Angola (Luanda) - Secondaire</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Entrepôt / Agence Chine
                </label>
                <select
                  value={chinaAgencyId}
                  onChange={(e) => setChinaAgencyId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                >
                  {chinaAgencies.length === 0 && <option value="">Aucune agence Chine configurée</option>}
                  {chinaAgencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Fournisseur / Vendeur chinois
                </label>
                <input
                  type="text"
                  placeholder="Ex: Guangzhou Jinlong Textile Co., Ltd."
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Référence d’achat / Facture
                </label>
                <input
                  type="text"
                  placeholder="Ex: Facture 16,800 RMB ou Bon n° JL-884"
                  value={purchaseInfo}
                  onChange={(e) => setPurchaseInfo(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>

          {/* 4. Pricing & Initial Payment */}
          <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-3 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-600" /> Tarification Fret & Acompte Initial
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Frais de transport fret ({pricingCurrency})
                </label>
                {hasTariff ? (
                  <input
                    type="text"
                    readOnly
                    value={pricing.ok ? money(pricing.value.freightAmount) : '—'}
                    title={`${Number(weightKg) || 0} kg × ${money(pricePerKg)}/kg`}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-slate-100 font-bold"
                  />
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 500"
                    value={transportCost}
                    onChange={(e) =>
                      setTransportCost(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-bold"
                  />
                )}
                <p className="text-[10px] text-slate-500 mt-1">
                  {hasTariff
                    ? `Tarif ${transportMode === 'AERIEN' ? 'aérien' : 'maritime'} : ${money(pricePerKg)}/kg`
                    : 'Aucun tarif/kg configuré : saisie manuelle.'}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Frais annexes (douane/manutention) ({pricingCurrency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={extraFees}
                  onChange={(e) =>
                    setExtraFees(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Acompte versé à l’enregistrement ({pricingCurrency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={amountPaid}
                  onChange={(e) =>
                    setAmountPaid(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-emerald-50 text-emerald-900 font-bold"
                />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-amber-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {pricing.ok ? (
                <>
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Montant total :</span>
                    <span>
                      {money(pricing.value.totalAmount)}
                      {pricingCurrency !== 'USD' && (
                        <span className="text-slate-500 font-semibold"> (≈ ${pricing.value.totalCostUSD.toFixed(2)})</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between font-black">
                    <span className="text-slate-900">Solde restant :</span>
                    <span className={pricing.value.remainingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {money(pricing.value.remainingAmount)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="sm:col-span-2 text-rose-700 font-semibold">
                  {weightKg === '' ? 'Saisissez le poids pour calculer le montant.' : pricing.error}
                </p>
              )}
            </div>
          </div>

          {/* 5. Photos */}
          <div
            className={`bg-slate-50 p-4 rounded-xl border transition ${
              isDraggingPhoto ? 'border-amber-500 bg-amber-50' : 'border-slate-200'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingPhoto(true);
            }}
            onDragLeave={() => setIsDraggingPhoto(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingPhoto(false);
              void handlePhotoFiles(e.dataTransfer.files);
            }}
          >
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-amber-500" /> Photos de Réception & Contrôle
              <span className="text-slate-400 font-semibold normal-case">
                ({photos.length}/{MAX_PHOTOS})
              </span>
            </h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {photos.map((p, idx) => (
                <div key={p} className="relative group w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border">
                  <img src={p} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded bg-rose-950/70 hover:bg-rose-700 text-white transition"
                    title="Retirer cette photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {Array.from({ length: uploadingCount }).map((_, idx) => (
                <div
                  key={`uploading-${idx}`}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-dashed border-amber-400 bg-amber-50 flex items-center justify-center text-[10px] font-semibold text-amber-700 animate-pulse"
                >
                  Envoi…
                </div>
              ))}
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              multiple
              className="hidden"
              onChange={(e) => void handlePhotoFiles(e.target.files)}
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photos.length + uploadingCount >= MAX_PHOTOS}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-white border border-amber-400 text-amber-800 hover:bg-amber-50 rounded-lg transition disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" /> Importer des photos
              </button>
              <span className="text-[11px] text-slate-500">
                Depuis l’ordinateur ou l’appareil photo du téléphone, ou glissez-déposez les images ici.
              </span>
            </div>
            {photoError && (
              <p role="alert" className="mt-2 text-[11px] text-rose-700 font-semibold">
                {photoError}
              </p>
            )}
          </div>

          {submitError && (
            <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {submitError}
            </p>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploadingCount > 0 || (weightKg !== '' && !pricing.ok)}
              className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              {isSubmitting
                ? 'Création en cours...'
                : uploadingCount > 0
                  ? 'Envoi des photos...'
                  : 'Enregistrer le Colis & Générer le Suivi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
