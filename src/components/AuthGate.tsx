import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Eye, EyeOff, KeyRound, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import type { User, UserRole } from '../types/index.ts';
import { getSupabaseConfigError, supabaseClient } from '../services/supabaseClient.ts';
import { SplashScreen } from './SplashScreen.tsx';

interface AuthGateProps {
  children: (user: User, signOut: () => Promise<void>) => React.ReactNode;
}

function toAppUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    email: row.email || '',
    phone: row.phone || '',
    role: row.role as UserRole,
    agencyId: row.agency_id || '',
    agencyName: row.agency_name || '',
    status: row.status,
    createdAt: row.created_at ? String(row.created_at).split('T')[0] : '',
  };
}

async function withTimeout<T>(operation: PromiseLike<T>, message: string, timeoutMs = 12000): Promise<T> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Adresse e-mail ou mot de passe incorrect. Vérifiez vos identifiants puis réessayez.';
  if (normalized.includes('email not confirmed')) return 'Votre adresse e-mail n’est pas encore confirmée. Ouvrez le message de confirmation reçu par e-mail.';
  if (normalized.includes('too many requests')) return 'Trop de tentatives de connexion. Patientez quelques minutes avant de réessayer.';
  return 'Connexion impossible pour le moment. Vérifiez vos identifiants et votre connexion, puis réessayez.';
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(getSupabaseConfigError());
  const [isLoading, setIsLoading] = useState(!getSupabaseConfigError());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const client = supabaseClient;
    if (!client) return;
    let active = true;

    const loadProfile = async (nextSession: Session | null) => {
      setSession(nextSession);
      setAppUser(null);
      if (!nextSession) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const { data, error: profileError } = await withTimeout(
          client.rpc('get_my_app_profile'),
          'Le chargement du profil Supabase dépasse 12 secondes. Vérifiez la connexion et les droits du compte.'
        );
        if (!active) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (profileError || !row) {
          setError(profileError?.message || 'Aucun profil actif n’est associé à ce compte Auth. Vérifiez le profil public.users.');
          await client.auth.signOut();
          if (active) setIsLoading(false);
          return;
        }
        setAppUser(toAppUser(row));
      } catch (profileError) {
        if (!active) return;
        setError(profileError instanceof Error ? profileError.message : 'Impossible de charger le profil Supabase.');
        await client.auth.signOut().catch(() => undefined);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void withTimeout(
      client.auth.getSession(),
      'La vérification de session Supabase dépasse 12 secondes. Vérifiez votre connexion internet.'
    ).then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message);
      return loadProfile(data.session);
    }).catch((loadError) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : 'Impossible de vérifier la session Supabase.');
      setIsLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        if (active) void loadProfile(nextSession).catch((loadError) => {
          if (!active) return;
          setError(loadError instanceof Error ? loadError.message : 'Erreur pendant le chargement du profil.');
          setIsLoading(false);
        });
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabaseClient) return;
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const { error: loginError } = await withTimeout(
        supabaseClient.auth.signInWithPassword({ email: email.trim(), password }),
        'La connexion Supabase dépasse 12 secondes. Vérifiez votre accès internet.'
      );
      if (loginError) setError(friendlyAuthError(loginError.message));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'La connexion a échoué. Réessayez dans quelques instants.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!supabaseClient) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Saisissez votre adresse e-mail pour recevoir le lien de réinitialisation.');
      return;
    }
    setError(null);
    setNotice(null);
    setIsResettingPassword(true);
    try {
      const { error: resetError } = await withTimeout(
        supabaseClient.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/?password-reset=1`,
        }),
        'La demande de réinitialisation prend trop de temps. Vérifiez votre connexion puis réessayez.'
      );
      if (resetError) {
        setError('Impossible d’envoyer le lien. Vérifiez l’adresse e-mail et réessayez.');
        console.error('[Auth password reset]', resetError.message);
      } else {
        setNotice('Si cette adresse correspond à un compte, un lien de réinitialisation a été envoyé. Vérifiez votre boîte de réception et vos courriers indésirables.');
      }
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Impossible d’envoyer le lien de réinitialisation.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabaseClient) return;
    const { error: signOutError } = await supabaseClient.auth.signOut();
    if (signOutError) setError(signOutError.message);
    setAppUser(null);
    setSession(null);
  };

  if (isLoading) return <SplashScreen message="Vérification sécurisée de votre session…" />;
  if (session && appUser) return <>{children(appUser, handleSignOut)}</>;

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#07111f] px-4 py-8 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-36 -top-36 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-9">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-600 text-2xl font-black text-slate-950 shadow-lg shadow-amber-500/20">GZ</div>
        <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300"><ShieldCheck className="h-3.5 w-3.5" /> Accès sécurisé</p>
        <h1 className="mt-2 text-center text-2xl font-black tracking-tight">GZ MUBUA GLOBAL</h1>
        <p className="mt-2 text-center text-sm text-slate-400">Connectez-vous à votre espace logistique.</p>

        {error && <div role="alert" aria-live="polite" className="mt-6 flex gap-2.5 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3.5 text-sm leading-5 text-rose-200"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" /><span>{error}</span></div>}
        {notice && <div role="status" aria-live="polite" className="mt-6 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3.5 text-sm leading-5 text-emerald-200">{notice}</div>}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-200">
            Adresse e-mail
            <span className="relative mt-1.5 block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input type="email" autoComplete="username" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={isSubmitting} placeholder="nom@entreprise.com" className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3 pl-10 pr-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 disabled:opacity-60 sm:text-sm" />
            </span>
          </label>

          <label className="block text-sm font-semibold text-slate-200">
            Mot de passe
            <span className="relative mt-1.5 block">
              <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={isSubmitting} className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3 pl-3 pr-12 text-base text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 disabled:opacity-60 sm:text-sm" />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} disabled={isSubmitting} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:bg-white/5 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 disabled:opacity-50">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </span>
          </label>

          <div className="flex justify-end">
            <button type="button" onClick={handlePasswordReset} disabled={isSubmitting || isResettingPassword || !supabaseClient} className="min-h-10 px-1 text-sm font-semibold text-amber-300 transition hover:text-amber-200 hover:underline disabled:cursor-wait disabled:opacity-60">
              {isResettingPassword ? 'Envoi du lien…' : 'Mot de passe oublié ?'}
            </button>
          </div>

          <button type="submit" disabled={isSubmitting || isResettingPassword || !supabaseClient} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 font-bold text-slate-950 shadow-lg shadow-amber-500/15 transition hover:from-amber-300 hover:to-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-wait disabled:opacity-60">
            {isSubmitting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Vérification des identifiants…</> : 'Se connecter'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">Votre espace logistique, sécurisé par GZ Mubua Global.</p>
      </section>
    </main>
  );
};
