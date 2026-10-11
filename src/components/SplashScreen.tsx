import React from 'react';
import { Globe2, ShieldCheck } from 'lucide-react';

interface SplashScreenProps {
  message?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  message = 'Préparation de votre espace de travail…',
}) => (
  <main
    className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#07111f] px-5 text-white"
    role="status"
    aria-live="polite"
  >
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,32,52,0.38),transparent_70%)]" />
    </div>

    <section className="w-full max-w-md text-center">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[1.7rem] border border-amber-300/30 bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 shadow-[0_0_60px_rgba(245,158,11,0.24)]">
        <span className="text-3xl font-black tracking-[-0.08em] text-[#101827]">GZ</span>
      </div>

      <p className="mb-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.32em] text-amber-300">
        <Globe2 className="h-3.5 w-3.5" /> Chine <span className="text-slate-600">/</span> RDC <span className="text-slate-600">/</span> Angola
      </p>
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">GZ MUBUA GLOBAL</h1>
      <p className="mt-2 text-sm font-medium text-slate-400">Gestion logistique & fret international</p>

      <div className="mx-auto mt-10 flex max-w-xs items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3.5 text-left shadow-xl backdrop-blur">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a1524] bg-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-200">{message}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-amber-300 to-orange-500 [animation:splash-progress_1.6s_ease-in-out_infinite_alternate]" />
          </div>
        </div>
      </div>

      <p className="mt-8 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-600">
        Transporter votre confiance, partout
      </p>
      <style>{`@keyframes splash-progress { from { transform: translateX(-45%); } to { transform: translateX(155%); } }`}</style>
    </section>
  </main>
);
