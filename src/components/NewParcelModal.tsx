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
import type { Client, TransportMode, Currency, Agency, ExchangeRates, PaymentMethodConfig } from '../types/index.ts';
import { api, formatCurrency, formatDay } from '../services/api.ts';
import { compressImageFile } from '../services/imageUpload.ts';
import { basisForMode, computeParcelPricing, currencyRate, volumeFromDimensionsCm } from '../../supabase/functions/_shared/parcelPricing.ts';

interface NewParcelModalProps {
  clients: Client[];
  agencies: Agency[];
  exchangeRates: ExchangeRates;
  paymentMethods?: PaymentMethodConfig[];
  onClose: () => void;
  onCreateParcel: (data: any) => Promise<void>;
  userName: string;
  userId: string;
  userRole: string;
  userAgencyId?: string;
}

export const NewParcelModal: React.FC<NewParcelModalProps> = ({
  clients,
  agencies,
  exchangeRates,
  paymentMethods = [],
  onClose,
  onCreateParcel,
  userName,
  userId,
  userRole,
  userAgencyId,
}) => {
  const [clientId, setClientId] = useState(clients[0]?.id || 'NEW');
  const [clientName, setClientName] = useState(clients[0]?.fullName || '');
  const [clientPhone, setClientPhone] = useState(clients[0]?.phone || '');
  // Optional: the sender is also a registered client (sees the parcel in their portal).
  const [senderClientId, setSenderClientId] = useState('');
  const [description, setDescription] = useState('');
  // Reception date of the parcel (defaults to today, local time; can be set to a past day).
  const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const [receptionDate, setReceptionDate] = useState(todayLocal);
  // Transit delay (days): default of the transport mode, editable per parcel.
  const defaultTransitDays = (mode: string) =>
    (mode === 'AERIEN' ? exchangeRates.aerienTransitDays : exchangeRates.maritimeTransitDays) ?? '';
  const [transitDays, setTransitDays] = useState<number | ''>('');
  const [quantity, setQuantity] = useState(1);
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [lengthCm, setLengthCm] = useState<number | ''>('');
  const [widthCm, setWidthCm] = useState<number | ''>('');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [transportMode, setTransportMode] = useState<TransportMode>('MARITIME');
  // Real destination agencies (RDC / Angola) recorded in Supabase.
  const destinationAgencies = agencies.filter((a) => a.country === 'RDC' || a.country === 'Angola');
  const [destinationAgencyId, setDestinationAgencyId] = useState(destinationAgencies[0]?.id || '');
  const destinationAgency = agencies.find((a) => a.id === destinationAgencyId);
  // Only real agencies can be referenced (parcels.china_agency_id is a foreign key).
  const chinaAgencies = agencies.filter((a) => a.country === 'Chine' || a.type !== 'destination');
  // The China team always registers for its own agency (enforced again by the API).
  const [chinaAgencyId, setChinaAgencyId] = useState(
    userRole === 'china_team' && userAgencyId ? userAgencyId : chinaAgencies[0]?.id || ''
  );
  // Reception address = the selected China agency's real address (no invented default).
  const chinaReceptionAddress = agencies.find((a) => a.id === chinaAgencyId)?.address || '';
  const [supplier, setSupplier] = useState('');
  const [purchaseInfo, setPurchaseInfo] = useState('');
  // Amounts below are expressed in the tariff currency (pricingCurrency).
  const [transportCost, setTransportCost] = useState<number | ''>('');
  const [extraFees] = useState<number | ''>(0); // field removed from the form: always 0
  const [amountPaid, setAmountPaid] = useState<number | ''>(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const MAX_PHOTOS = 10;
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Air is billed by weight (price per kg), sea by volume (price per CBM);
  // tariffs come from the admin settings. 0 means manual pricing.
  const pricingCurrency: Currency = exchangeRates.freightRateCurrency || 'USD';
  const basis = basisForMode(transportMode);
  // The delay proposed follows the transport mode (default set in Settings).
  useEffect(() => {
    setTransitDays(defaultTransitDays(transportMode));
  }, [transportMode, exchangeRates.aerienTransitDays, exchangeRates.maritimeTransitDays]);
  const estimatedArrival = (() => {
    if (transitDays === '' || !Number.isInteger(Number(transitDays)) || Number(transitDays) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(receptionDate)) return null;
    const d = new Date(`${receptionDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Number(transitDays));
    return d.toISOString().slice(0, 10);
  })();
  const unitPrice = (basis === 'KG' ? exchangeRates.aerienPricePerKg : exchangeRates.maritimePricePerCbm) || 0;
  const hasTariff = unitPrice > 0;
  const volumeCbm = volumeFromDimensionsCm(lengthCm, widthCm, heightCm);
  const hasMeasure = basis === 'KG' ? weightKg !== '' : lengthCm !== '' || widthCm !== '' || heightCm !== '';
  const pricing = useMemo(
    () =>
      computeParcelPricing({
        basis,
        weightKg: basis === 'KG' ? Number(weightKg) : 0,
        volumeCbm: volumeCbm ?? 0,
        unitPrice,
        manualFreightAmount: Number(transportCost) || 0,
        extraFees: Number(extraFees) || 0,
        amountPaid: Number(amountPaid) || 0,
        currency: pricingCurrency,
        exchangeRate: currencyRate(pricingCurrency, exchangeRates),
      }),
    [basis, weightKg, volumeCbm, unitPrice, transportCost, extraFees, amountPaid, pricingCurrency, exchangeRates]
  );
  const money = (amount: number) => formatCurrency(amount, pricingCurrency);
  // The down payment goes to the cash box of the parcel's China agency (else the agent's agency).
  const downPaymentAgency = agencies.find((a) => a.id === (chinaAgencyId || userAgencyId));
  const downPaymentCountry = downPaymentAgency?.country;
  const downPaymentMethods = paymentMethods
    .filter((m) => m.country === downPaymentCountry && m.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);

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
    if (!clientName.trim() || !clientPhone.trim() || !description.trim()) {
      setSubmitError('Veuillez remplir le nom du client, le téléphone et la description.');
      return;
    }
    if (!receptionDate || receptionDate > todayLocal) {
      setSubmitError('Indiquez une date de réception valide (pas dans le futur).');
      return;
    }
    if (Number(amountPaid) > 0 && !downPaymentMethods.some((m) => m.code === paymentMethod)) {
      setSubmitError('Choisissez le mode de paiement de l’acompte (« Reçu par »).');
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
        senderClientId: senderClientId || null,
        description,
        chinaReceptionDate: receptionDate,
        estimatedTransitDays: transitDays === '' ? null : Number(transitDays),
        quantity: Number(quantity) || 1,
        // Air: weight only. Sea: dimensions (cm) -> volume (CBM), weight not required.
        weightKg: basis === 'KG' ? Number(weightKg) : 0,
        lengthCm: basis === 'CBM' ? Number(lengthCm) : undefined,
        widthCm: basis === 'CBM' ? Number(widthCm) : undefined,
        heightCm: basis === 'CBM' ? Number(heightCm) : undefined,
        volumeCbm: basis === 'CBM' ? volumeCbm ?? undefined : undefined,
        photos,
        supplier: supplier.trim(),
        purchaseInfo,
        chinaReceptionAddress,
        chinaAgencyId: chinaAgencyId || null,
        chinaAgencyName: chinaAgency?.name || '',
        transportMode,
        // Destination = a real agency; the API derives the agency name and city.
        destination: destinationAgency ? (destinationAgency.country === 'Angola' ? 'Angola' : 'Kinshasa') : '',
        destinationAgencyId: destinationAgencyId || null,
        // The server recomputes the price; these let it detect a tariff change meanwhile.
        pricingCurrency,
        appliedUnitPrice: unitPrice,
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
            {clients.length > 0 && (
              <div className="mt-3">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Expéditeur (si c’est aussi un client enregistré)
                </label>
                <select
                  value={senderClientId}
                  onChange={(e) => setSenderClientId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">— Aucun (fournisseur / expéditeur externe) —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. Transport mode + merchandise details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
              <Box className="w-4 h-4 text-amber-500" /> Mode de transport & Marchandise
            </h4>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setTransportMode('AERIEN')}
                aria-pressed={transportMode === 'AERIEN'}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                  transportMode === 'AERIEN'
                    ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                <Plane className="w-4 h-4" /> Transport aérien
                <span className="font-normal opacity-80">(au kg)</span>
              </button>
              <button
                type="button"
                onClick={() => setTransportMode('MARITIME')}
                aria-pressed={transportMode === 'MARITIME'}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                  transportMode === 'MARITIME'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                <Ship className="w-4 h-4" /> Transport maritime
                <span className="font-normal opacity-80">(au CBM)</span>
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nom / description des articles *
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
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Date de réception du colis *
                  </label>
                  <input
                    type="date"
                    required
                    max={todayLocal}
                    value={receptionDate}
                    onChange={(e) => setReceptionDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Délai d’acheminement ({transportMode === 'AERIEN' ? 'aérien' : 'maritime'}, jours)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="365"
                    placeholder="Ex: 45"
                    value={transitDays}
                    onChange={(e) => setTransitDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Arrivée estimée à destination
                  </label>
                  <div className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-100 font-bold text-slate-800">
                    {estimatedArrival ? formatDay(estimatedArrival) : '— (saisissez le délai)'}
                  </div>
                </div>
              </div>

              {transportMode === 'AERIEN' ? (
                <div className="grid grid-cols-2 gap-3">
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
                      Poids du colis (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="Ex: 4,02"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                      Longueur (cm) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      placeholder="Ex: 100"
                      value={lengthCm}
                      onChange={(e) => setLengthCm(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Largeur (cm) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      placeholder="Ex: 80"
                      value={widthCm}
                      onChange={(e) => setWidthCm(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Hauteur (cm) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      placeholder="Ex: 50"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Volume (CBM = m³)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={volumeCbm !== null ? volumeCbm.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—'}
                      title="Longueur × Largeur × Hauteur (cm) ÷ 1 000 000"
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-amber-50 font-mono font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Routing & Reception in China */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
              <Ship className="w-4 h-4 text-amber-500" /> Expédition, Acheminement & Réception Chine
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Destination Finale
                </label>
                <select
                  value={destinationAgencyId}
                  required
                  onChange={(e) => setDestinationAgencyId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                >
                  {destinationAgencies.length === 0 && <option value="">Aucune agence de destination configurée</option>}
                  {destinationAgencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.city}, {a.country})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Entrepôt / Agence Chine
                </label>
                <select
                  value={chinaAgencyId}
                  onChange={(e) => setChinaAgencyId(e.target.value)}
                  disabled={userRole === 'china_team'}
                  title={userRole === 'china_team' ? 'Votre agence attribuée' : undefined}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
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
                    title={basis === 'KG' ? `${Number(weightKg) || 0} kg × ${money(unitPrice)}/kg` : `${volumeCbm ?? 0} m³ × ${money(unitPrice)}/CBM`}
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
                    ? basis === 'KG'
                      ? `Aérien : ${Number(weightKg) || 0} kg × ${money(unitPrice)}/kg`
                      : `Maritime : ${(volumeCbm ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} m³ × ${money(unitPrice)}/CBM`
                    : `Aucun tarif ${basis === 'KG' ? 'aérien/kg' : 'maritime/CBM'} configuré : saisie manuelle.`}
                </p>
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

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Mode de paiement de l’acompte{Number(amountPaid) > 0 ? ' *' : ''}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  required={Number(amountPaid) > 0}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  title="Moyen de paiement de l’acompte (caisse de l’agence Chine du colis, sinon de votre agence)"
                >
                  <option value="">
                    {downPaymentMethods.length === 0 ? 'Aucun moyen configuré pour cette caisse' : '— Choisir le mode de paiement —'}
                  </option>
                  {downPaymentMethods.map((m) => (
                    <option key={m.id} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Caisse {downPaymentAgency?.name || '—'}{Number(amountPaid) > 0 ? '' : ' · obligatoire si un acompte est versé'}
                </p>
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
                  {!hasMeasure
                    ? basis === 'KG'
                      ? 'Saisissez le poids pour calculer le montant.'
                      : 'Saisissez la longueur, la largeur et la hauteur pour calculer le volume et le montant.'
                    : pricing.error}
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
              disabled={isSubmitting || uploadingCount > 0 || (hasMeasure && !pricing.ok)}
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
