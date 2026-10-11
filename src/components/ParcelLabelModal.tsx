import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Package, QrCode } from 'lucide-react';
import type { Parcel } from '../types/index.ts';

interface ParcelLabelModalProps {
  parcel: Parcel | null;
  onClose: () => void;
}

export const ParcelLabelModal: React.FC<ParcelLabelModalProps> = ({ parcel, onClose }) => {
  if (!parcel) return null;

  const handlePrint = () => {
    window.print();
  };

  // Rendered under <body> (outside #root) so printing can hide the app and keep only the label.
  return createPortal(
    <div className="print-sheet-root fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="print-sheet-frame bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[95vh] flex flex-col overflow-hidden">
        {/* Controls Header */}
        <div className="bg-slate-900 text-white p-3 sm:p-4 flex items-center justify-between gap-2 no-print">
          <div className="flex min-w-0 items-center gap-2">
            <Package className="w-5 h-5 shrink-0 text-amber-400" />
            <span className="font-bold text-xs sm:text-sm truncate">Étiquette d'Expédition / Fret Carton</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Label Sheet */}
        <div className="print-sheet-body p-3 sm:p-6 bg-slate-100 flex items-start justify-center overflow-y-auto">
          <div className="print-label w-full bg-white p-3 sm:p-6 border-4 border-slate-900 rounded-xl shadow-lg font-sans text-slate-900 space-y-3 sm:space-y-4">
            {/* Company branding header */}
            <div className="flex items-center justify-between gap-2 border-b-2 border-slate-900 pb-3">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-black tracking-tight leading-none text-slate-950">
                  GZ MUBUA GLOBAL
                </h2>
                <p className="text-[10px] font-bold tracking-wider text-slate-600 uppercase mt-0.5">
                  FRET MARITIME & AÉRIEN • GUANGZHOU ➔ KINSHASA / ANGOLA
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 bg-slate-900 text-white text-xs font-black uppercase rounded">
                  {parcel.transportMode}
                </span>
              </div>
            </div>

            {/* Destination Highlight */}
            <div className="bg-slate-900 text-white p-3 rounded-lg text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block">
                DESTINATION FINALE
              </span>
              <div className="text-xl sm:text-2xl font-black tracking-wide uppercase mt-0.5 break-words">
                {parcel.destination}
              </div>
              <div className="text-xs text-slate-300 font-semibold">
                {parcel.destinationAgencyName}
              </div>
            </div>

            {/* Tracking Code & Mock Barcode */}
            <div className="text-center py-2 border-y-2 border-dashed border-slate-300">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                NUMÉRO DE SUIVI OFFICIEL
              </div>
              <div className="text-lg sm:text-2xl font-black font-mono tracking-wider sm:tracking-widest text-slate-950 my-1 break-all">
                {parcel.trackingNumber}
              </div>

              {/* Barcode visual lines */}
              <div className="h-12 w-full max-w-[280px] mx-auto flex items-stretch justify-center gap-[2px] sm:gap-[3px] py-1 overflow-hidden">
                {[
                  3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 3, 2, 1, 4,
                  2, 1, 3, 1, 2, 4,
                ].map((w, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 h-full"
                    style={{ width: `${w * 1.5}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Client & Specs details */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs pt-1">
              <div className="min-w-0 break-words">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">
                  DESTINATAIRE
                </span>
                <p className="font-black text-sm text-slate-950">{parcel.clientName}</p>
                <p className="text-slate-700 font-semibold">{parcel.clientPhone}</p>
              </div>

              <div className="min-w-0 text-right break-words">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">
                  EXPÉDITEUR / HUB
                </span>
                <p className="font-bold text-slate-900">{parcel.chinaAgencyName}</p>
                <p className="text-slate-600 text-[11px]">{parcel.supplier}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">COLISAGE</span>
                <span className="font-black text-slate-900">{parcel.quantity} colis</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">POIDS</span>
                <span className="font-black text-slate-900">{parcel.weightKg} KG</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">VOLUME</span>
                <span className="font-black text-slate-900">{parcel.volumeCbm} M³</span>
              </div>
            </div>

            {/* Description & Warehouse Location */}
            <div className="text-xs border-t border-slate-200 pt-2 flex items-center justify-between gap-2 text-slate-700">
              <span className="min-w-0 truncate">
                <strong>Contenu :</strong> {parcel.description}
              </span>
              {parcel.warehouseLocation && (
                <span className="shrink-0 whitespace-nowrap font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[11px]">
                  {parcel.warehouseLocation}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
