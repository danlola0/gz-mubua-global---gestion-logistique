import React from 'react';
import { X, Printer, DollarSign, CheckCircle2 } from 'lucide-react';
import type { Payment, PaymentMethodConfig } from '../types/index.ts';
import { formatUSD, formatCurrency } from '../services/api.ts';

interface PaymentReceiptModalProps {
  payment: Payment | null;
  onClose: () => void;
  paymentMethods?: PaymentMethodConfig[];
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({ payment, onClose, paymentMethods = [] }) => {
  const methodName = paymentMethods.find((m) => m.code === payment?.paymentMethod)?.label || payment?.paymentMethod;
  if (!payment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col overflow-hidden">
        {/* Controls */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">Reçu Officiel d'Encaissement</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer Reçu
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
        <div className="p-6 bg-slate-100 flex items-center justify-center">
          <div className="w-full bg-white p-6 border-2 border-slate-300 rounded-xl shadow font-sans text-slate-900 space-y-4">
            {/* Header */}
            <div className="text-center border-b pb-3 border-slate-200">
              <img src="/logo.png" alt="GZ Mubua Global" className="mx-auto mb-2 h-20 w-auto object-contain" />
              <h2 className="text-xl font-black text-slate-950">GZ MUBUA GLOBAL</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                TRANSIT • FRET INTERNATIONAL • CHINE - KINSHASA - ANGOLA
              </p>
              <div className="mt-2 inline-block px-3 py-1 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-mono font-bold text-xs">
                REÇU DE CAISSE N° : {payment.receiptNumber}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Heure :</span>
                <span className="font-bold text-slate-900">
                  {payment.date} à {payment.time}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Agence émettrice :</span>
                <span className="font-semibold text-slate-900">{payment.agencyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Caissier(ère) :</span>
                <span className="font-semibold text-slate-900">{payment.cashierName}</span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between">
                <span className="text-slate-500">Client :</span>
                <span className="font-black text-sm text-slate-900">{payment.clientName}</span>
              </div>
              {payment.parcelTrackingNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Colis lié :</span>
                  <span className="font-mono font-bold text-blue-700">
                    {payment.parcelTrackingNumber}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Nature du paiement :</span>
                <span className="font-bold text-slate-800">{payment.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mode de règlement :</span>
                <span className="font-semibold text-slate-800">{methodName}</span>
              </div>
              {payment.reference && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Référence transaction :</span>
                  <span className="font-mono text-slate-700">{payment.reference}</span>
                </div>
              )}
            </div>

            {/* Amount Box */}
            <div className="p-4 bg-slate-900 text-white rounded-xl text-center space-y-1">
              <span className="text-[10px] text-amber-400 uppercase tracking-wider block font-bold">
                MONTANT ENCAISSÉ
              </span>
              <div className="text-2xl font-black text-white">
                {formatCurrency(payment.originalAmount, payment.currency)}
              </div>
              {payment.currency !== 'USD' && (
                <div className="text-[11px] text-slate-300">
                  Contrevaleur : <strong>{formatUSD(payment.amountUSD)}</strong> (Taux appliqué :{' '}
                  {payment.exchangeRate})
                </div>
              )}
            </div>

            {payment.notes && (
              <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                Note : {payment.notes}
              </p>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500">
              <div>
                <p className="font-bold mb-8">Signature Caissier</p>
                <p className="border-t border-slate-300 pt-1">GZ MUBUA GLOBAL</p>
              </div>
              <div>
                <p className="font-bold mb-8">Signature Client</p>
                <p className="border-t border-slate-300 pt-1">Pour acquit</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
