import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jwlzyxhiqvsvghkjwhrz.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Biq-HgggkLcmOsC6QWFiBQ_ZETM2-En';

export interface CookieStoreLike {
  getAll(): { name: string; value: string }[];
  set?(name: string, value: string, options?: any): void;
}

export const createClient = (cookieStore?: any) => {
  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore?.getAll ? cookieStore.getAll() : [];
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (cookieStore?.set) {
                cookieStore.set(name, value, options);
              }
            });
          } catch {
            // Ignored if in server component or immutable context
          }
        },
      },
    },
  );
};
