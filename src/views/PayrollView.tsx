import React, { useState } from 'react';
import {
  UserCheck,
  PlusCircle,
  Printer,
  DollarSign,
  Building2,
  Calendar,
  CheckCircle2,
  X,
  FileText,
} from 'lucide-react';
import type { Employee, SalaryPayment, Currency, Agency, UserRole } from '../types/index.ts';
import { formatUSD, formatCurrency } from '../services/api.ts';

interface PayrollViewProps {
  employees: Employee[];
  salaryPayments: SalaryPayment[];
  agencies: Agency[];
  userRole: UserRole;
  userName: string;
  userId: string;
  onCreateSalaryPayment: (data: any) => Promise<void>;
  onCreateEmployee: (data: any) => Promise<void>;
}

export const PayrollView: React.FC<PayrollViewProps> = ({
  employees,
  salaryPayments,
  agencies,
  userRole,
  userName,
  userId,
  onCreateSalaryPayment,
  onCreateEmployee,
}) => {
  const [activeTab, setActiveTab] = useState<'slips' | 'employees'>('slips');
  const [showPayModal, setShowPayModal] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<SalaryPayment | null>(null);

  // Pay Slip Form
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const [periodMonth, setPeriodMonth] = useState('2026-10');
  const [baseSalaryUSD, setBaseSalaryUSD] = useState<number | ''>(employees[0]?.baseSalaryUSD || 1000);
  const [primesUSD, setPrimesUSD] = useState<number | ''>(0);
  const [avancesUSD, setAvancesUSD] = useState<number | ''>(0);
  const [retenuesUSD, setRetenuesUSD] = useState<number | ''>(0);
  const [overtimeUSD, setOvertimeUSD] = useState<number | ''>(0);
  const [currency, setCurrency] = useState<Currency>(employees[0]?.preferredCurrency || 'USD');
  const [paymentMethod, setPaymentMethod] = useState('Virement Bancaire');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Employee Form
  const [empFullName, setEmpFullName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empJobTitle, setEmpJobTitle] = useState('');
  const [empAgencyId, setEmpAgencyId] = useState(agencies[0]?.id || 'AG-GOMBE');
  const [empBaseUSD, setEmpBaseUSD] = useState<number | ''>(800);
  const [empCurr, setEmpCurr] = useState<Currency>('USD');

  // Handle employee change in pay slip
  const handleEmpChange = (empId: string) => {
    setSelectedEmpId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setBaseSalaryUSD(emp.baseSalaryUSD);
      setCurrency(emp.preferredCurrency);
    }
  };

  const handleCreateSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;

    setIsSubmitting(true);
    try {
      await onCreateSalaryPayment({
        employeeId: emp.id,
        employeeName: emp.fullName,
        jobTitle: emp.jobTitle,
        agencyName: emp.agencyName,
        country: emp.country,
        periodMonth,
        baseSalaryUSD: Number(baseSalaryUSD) || 0,
        primesUSD: Number(primesUSD) || 0,
        avancesUSD: Number(avancesUSD) || 0,
        retenuesUSD: Number(retenuesUSD) || 0,
        overtimeUSD: Number(overtimeUSD) || 0,
        currency,
        paymentMethod,
        notes,
        userName,
        userId,
      });

      setShowPayModal(false);
      setPrimesUSD(0);
      setAvancesUSD(0);
      setRetenuesUSD(0);
      setOvertimeUSD(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const agency = agencies.find((a) => a.id === empAgencyId);
    setIsSubmitting(true);
    try {
      await onCreateEmployee({
        fullName: empFullName,
        phone: empPhone,
        jobTitle: empJobTitle,
        agencyId: empAgencyId,
        agencyName: agency?.name || 'Agence GZ MUBUA',
        country: agency?.country || 'RDC',
        baseSalaryUSD: Number(empBaseUSD) || 600,
        preferredCurrency: empCurr,
      });
      setShowEmpModal(false);
      setEmpFullName('');
      setEmpPhone('');
      setEmpJobTitle('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPayrollUSD = salaryPayments.reduce((s, p) => s + (p.netSalaryUSD || 0), 0);
  const chinaPayrollUSD = salaryPayments
    .filter((p) => p.country === 'Chine')
    .reduce((s, p) => s + (p.netSalaryUSD || 0), 0);
  const kinshasaPayrollUSD = salaryPayments
    .filter((p) => p.country === 'RDC')
    .reduce((s, p) => s + (p.netSalaryUSD || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Ressources Humaines & Salaires
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
              {employees.length} Employés
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Gestion du personnel en Chine (Guangzhou) et à Kinshasa/Angola, fiches de paie et
            décomptes mensuels.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowEmpModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
          >
            + Nouvel Employé
          </button>
          <button
            onClick={() => setShowPayModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Émettre Bulletin de Paie
          </button>
        </div>
      </div>

      {/* Salary Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-slate-400">
            Masse Salariale Totale Versée
          </span>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {formatUSD(totalPayrollUSD)}
          </div>
          <span className="text-[10px] text-slate-400">Chine + Kinshasa + Angola</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-slate-700">
            Salaires Équipe Chine (Guangzhou)
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatUSD(chinaPayrollUSD)}
          </div>
          <span className="text-[10px] text-slate-700">Rémunérés en CNY / USD</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-slate-700">
            Salaires Équipe Kinshasa
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatUSD(kinshasaPayrollUSD)}
          </div>
          <span className="text-[10px] text-slate-700">Rémunérés en USD / CDF</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-sm gap-1">
        <button
          onClick={() => setActiveTab('slips')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'slips'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" /> Bulletins & Historique des Paies ({salaryPayments.length})
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'employees'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" /> Registre du Personnel ({employees.length})
        </button>
      </div>

      {/* Slips table */}
      {activeTab === 'slips' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">N° Bulletin</th>
                  <th className="py-3 px-4">Période</th>
                  <th className="py-3 px-4">Employé</th>
                  <th className="py-3 px-4">Fonction & Agence</th>
                  <th className="py-3 px-4">Salaire Net USD</th>
                  <th className="py-3 px-4">Montant Versé</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Fiche de Paie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salaryPayments.map((slip) => (
                  <tr key={slip.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {slip.slipNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold">{slip.periodMonth}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{slip.employeeName}</td>
                    <td className="py-3 px-4">
                      <div>{slip.jobTitle}</div>
                      <div className="text-[10px] text-slate-700">
                        {slip.agencyName} ({slip.country})
                      </div>
                    </td>
                    <td className="py-3 px-4 font-black text-slate-900">
                      {formatUSD(slip.netSalaryUSD)}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-700">
                      {formatCurrency(slip.paidAmountOriginal, slip.currency)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {slip.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedSlip(slip)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition ml-auto"
                      >
                        <Printer className="w-3.5 h-3.5" /> Imprimer Fiche
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employees roster */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div key={emp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-700 font-bold">
                    {emp.employeeCode}
                  </span>
                  <h3 className="font-black text-slate-900 text-base">{emp.fullName}</h3>
                  <p className="text-xs text-amber-700 font-bold">{emp.jobTitle}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {emp.status}
                </span>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-700">Agence :</span>
                  <span className="font-semibold">{emp.agencyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Pays :</span>
                  <span className="font-semibold">{emp.country}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Téléphone :</span>
                  <span className="font-semibold">{emp.phone}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-700">Salaire de base :</span>
                  <span className="font-black text-slate-900">
                    {formatUSD(emp.baseSalaryUSD)} / mois
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Printable Pay Slip Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between no-print">
              <span className="font-bold text-sm">Bulletin Individuel de Rémunération</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                >
                  Imprimer
                </button>
                <button
                  onClick={() => setSelectedSlip(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex items-center justify-center">
              <div className="w-full bg-white p-6 border border-slate-300 rounded-xl shadow space-y-4 text-xs font-sans">
                <div className="text-center border-b pb-3">
                  <h2 className="text-lg font-black text-slate-950">GZ MUBUA GLOBAL</h2>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    BULLETIN OFFICIEL DE PAIE • {selectedSlip.periodMonth}
                  </p>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    N° : {selectedSlip.slipNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 block">EMPLOYÉ</span>
                    <strong className="text-slate-900 text-sm">{selectedSlip.employeeName}</strong>
                    <p className="text-[11px]">{selectedSlip.jobTitle}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">AFFECTATION</span>
                    <strong className="text-slate-900">{selectedSlip.agencyName}</strong>
                    <p className="text-[11px]">{selectedSlip.country}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Salaire de base brut :</span>
                    <strong>{formatUSD(selectedSlip.baseSalaryUSD)}</strong>
                  </div>
                  {selectedSlip.primesUSD > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Primes de rendement :</span>
                      <span>+{formatUSD(selectedSlip.primesUSD)}</span>
                    </div>
                  )}
                  {selectedSlip.overtimeUSD > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Heures supplémentaires :</span>
                      <span>+{formatUSD(selectedSlip.overtimeUSD)}</span>
                    </div>
                  )}
                  {selectedSlip.avancesUSD > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Avance sur salaire déduite :</span>
                      <span>-{formatUSD(selectedSlip.avancesUSD)}</span>
                    </div>
                  )}
                  {selectedSlip.retenuesUSD > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Retenues diverses :</span>
                      <span>-{formatUSD(selectedSlip.retenuesUSD)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-sm text-slate-950">
                    <span>NET À PAYER :</span>
                    <span className="text-amber-600">{formatUSD(selectedSlip.netSalaryUSD)}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 text-white rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block uppercase">
                    MONTANT VERSÉ EN DEVISE LOCALE
                  </span>
                  <div className="text-lg font-black">
                    {formatCurrency(selectedSlip.paidAmountOriginal, selectedSlip.currency)}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Mode : {selectedSlip.paymentMethod}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Émettre Bulletin de Paie */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <h3 className="font-bold text-base text-slate-900">Émettre un Bulletin de Paie</h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSlip} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Employé *</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => handleEmpChange(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  required
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.jobTitle} - {e.country})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Période (Mois)</label>
                  <input
                    type="month"
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Salaire de base ($ USD)</label>
                  <input
                    type="number"
                    value={baseSalaryUSD}
                    onChange={(e) =>
                      setBaseSalaryUSD(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Primes ($)</label>
                  <input
                    type="number"
                    value={primesUSD}
                    onChange={(e) =>
                      setPrimesUSD(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full p-1.5 rounded border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Avances ($)</label>
                  <input
                    type="number"
                    value={avancesUSD}
                    onChange={(e) =>
                      setAvancesUSD(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full p-1.5 rounded border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Heures Sup ($)</label>
                  <input
                    type="number"
                    value={overtimeUSD}
                    onChange={(e) =>
                      setOvertimeUSD(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full p-1.5 rounded border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Devise de versement</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CNY">CNY (¥ Chine)</option>
                    <option value="CDF">CDF (FC Kinshasa)</option>
                    <option value="AOA">AOA (Kz Angola)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Mode de versement</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  >
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                >
                  {isSubmitting ? 'Traitement...' : 'Valider & Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Employee */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-xs">
            <h3 className="font-bold text-base text-slate-900 mb-3">Ajouter un Employé</h3>
            <form onSubmit={handleCreateEmployeeSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={empFullName}
                  onChange={(e) => setEmpFullName(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Téléphone *</label>
                <input
                  type="text"
                  required
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Fonction / Rôle *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Chef Dépôt, Superviseur Chine..."
                  value={empJobTitle}
                  onChange={(e) => setEmpJobTitle(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Agence de rattachement</label>
                <select
                  value={empAgencyId}
                  onChange={(e) => setEmpAgencyId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                >
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.country})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Salaire de base ($ USD)</label>
                <input
                  type="number"
                  value={empBaseUSD}
                  onChange={(e) =>
                    setEmpBaseUSD(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
