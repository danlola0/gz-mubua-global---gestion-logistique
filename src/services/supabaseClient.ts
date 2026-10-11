import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getSupabaseConfigError(): string | null {
  if (supabaseClient) return null;
  return 'La configuration publique Supabase manque dans le build. Définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY avant npm run build.';
}
