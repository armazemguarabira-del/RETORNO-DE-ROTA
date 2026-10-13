import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) || 'https://jwlzyxhiqvsvghkjwhrz.supabase.co';
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) || 'sb_publishable_Biq-HgggkLcmOsC6QWFiBQ_ZETM2-En';

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );

export const supabase = createClient();
