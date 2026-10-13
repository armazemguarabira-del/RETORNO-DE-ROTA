import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://jwlzyxhiqvsvghkjwhrz.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || 'sb_publishable_Biq-HgggkLcmOsC6QWFiBQ_ZETM2-En';

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );
