// Installable application (PWA): service worker registration and the browser's
// install prompt (Chrome / Edge on computer and Android).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(canInstall: boolean) => void>();
const notify = () => listeners.forEach((listener) => listener(deferredPrompt !== null));

export const canInstallApp = () => deferredPrompt !== null;

export const onInstallAvailabilityChange = (listener: (canInstall: boolean) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Opens the browser's install window. Returns true if the user accepted. */
export async function installApp(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  notify();
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome === 'accepted';
}

/** True when the application already runs as an installed app (own window). */
export const isRunningInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function installPwa(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // shown through our own button instead
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });

  // The service worker is only used on the deployed site (not in local development).
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* the site keeps working normally without it */
      });
    });
  }
}
