// "Installer l'application" button, visible only when the browser allows installation.
import React, { useEffect, useState } from 'react';
import { MonitorDown } from 'lucide-react';
import { canInstallApp, installApp, isRunningInstalled, onInstallAvailabilityChange } from '../services/pwa.ts';

export const InstallAppButton: React.FC<{ variant?: 'dark' | 'light' }> = ({ variant = 'dark' }) => {
  const [available, setAvailable] = useState(canInstallApp());

  useEffect(() => {
    const unsubscribe = onInstallAvailabilityChange(setAvailable);
    return () => {
      unsubscribe();
    };
  }, []);

  if (!available || isRunningInstalled()) return null;

  const colors =
    variant === 'dark'
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40 hover:bg-emerald-500/20'
      : 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100';

  return (
    <button
      type="button"
      onClick={() => void installApp()}
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-bold transition ${colors}`}
      title="Installer l’application sur cet appareil"
    >
      <MonitorDown className="h-4 w-4" />
      <span className="hidden sm:inline">Installer l’application</span>
    </button>
  );
};
