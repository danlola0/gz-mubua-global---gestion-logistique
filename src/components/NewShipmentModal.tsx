import React, { useMemo, useState } from 'react';
import { X, Ship, Plane } from 'lucide-react';
import type { Agency, Shipment } from '../types/index.ts';

interface NewShipmentModalProps {
  agencies: Agency[];
  onClose: () => void;
  onCreateShipment: (data: Partial<Shipment>) => Promise<void>;
}

export const NewShipmentModal: React.FC<NewShipmentModalProps> = ({
  agencies,
  onClose,
  onCreateShipment,
}) => {
  const origins = useMemo(
    () => agencies.filter((agency) => agency.type === 'origin' || agency.type === 'hub'),
    [agencies]
  );
  const destinations = useMemo(
    () => agencies.filter((agency) => agency.type === 'destination' || agency.type === 'hub'),
    [agencies]
  );
  const [transportMode, setTransportMode] = useState<Shipment['transportMode']>('MARITIME');
  const [departureAgencyId, setDepartureAgencyId] = useState(origins[0]?.id || '');
  const [destinationAgencyId, setDestinationAgencyId] = useState(destinations[0]?.id || '');
  const [destination, setDestination] = useState(destinations[0]?.city || '');
  const [carrierName, setCarrierName] = useState('');
  const [containerOrFlightNumber, setContainerOrFlightNumber] = useState('');
  const [departureDate, setDepartureDate] = useState(new Date().toISOString().slice(0, 10));
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState('');
  const [totalCostUSD, setTotalCostUSD] = useState('0');
  const [comments, setComments] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const departureAgency = agencies.find((agency) => agency.id === departureAgencyId);
      const destinationAgency = agencies.find((agency) => agency.id === destinationAgencyId);
      await onCreateShipment({
        departureAgencyId,
        departureAgencyName: departureAgency?.name,
        destinationAgencyId,
        destinationAgencyName: destinationAgency?.name,
        destination,
        transportMode,
        carrierName,
        containerOrFlightNumber,
        departureDate,
        estimatedArrivalDate,
        totalCostUSD: Number(totalCostUSD) || 0,
        comments,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Échec de création de l’expédition.');
    } finally {
      setIsSaving(false);
    }
  };

  const originOptions = origins.length ? origins : agencies;
  const destinationOptions = destinations.length ? destinations : agencies;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
              {transportMode === 'MARITIME' ? <Ship className="h-5 w-5" /> : <Plane className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Créer une expédition</h2>
              <p className="text-xs text-slate-500">L’expédition sera enregistrée dans Supabase.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {agencies.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
              Créez d’abord au moins une agence dans Supabase pour pouvoir rattacher cette expédition.
            </p>
          )}
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              Mode de transport
              <select value={transportMode} onChange={(event) => setTransportMode(event.target.value as Shipment['transportMode'])} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="MARITIME">Maritime</option>
                <option value="AERIEN">Aérien</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Destination
              <input required value={destination} onChange={(event) => setDestination(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ville / pays" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Agence de départ
              <select required value={departureAgencyId} onChange={(event) => setDepartureAgencyId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="" disabled>Sélectionner une agence</option>
                {originOptions.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Agence de destination
              <select required value={destinationAgencyId} onChange={(event) => setDestinationAgencyId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="" disabled>Sélectionner une agence</option>
                {destinationOptions.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Transporteur
              <input required value={carrierName} onChange={(event) => setCarrierName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nom de la compagnie" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              {transportMode === 'MARITIME' ? 'N° conteneur' : 'N° de vol'}
              <input required value={containerOrFlightNumber} onChange={(event) => setContainerOrFlightNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Date de départ
              <input required type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Arrivée estimée
              <input type="date" value={estimatedArrivalDate} onChange={(event) => setEstimatedArrivalDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
              Coût total estimé (USD)
              <input min="0" step="0.01" type="number" value={totalCostUSD} onChange={(event) => setTotalCostUSD(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
              Notes
              <textarea rows={2} value={comments} onChange={(event) => setComments(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Annuler</button>
            <button type="submit" disabled={isSaving || agencies.length === 0} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
              {isSaving ? 'Enregistrement…' : 'Enregistrer dans Supabase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
