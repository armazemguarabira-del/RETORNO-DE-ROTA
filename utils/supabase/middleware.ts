import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jwlzyxhiqvsvghkjwhrz.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Biq-HgggkLcmOsC6QWFiBQ_ZETM2-En';

export const createClient = (request: any) => {
  let cookies: Record<string, string> = {};
  
  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          if (request?.cookies?.getAll) return request.cookies.getAll();
          return [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            cookies[name] = value;
          });
        },
      },
    },
  );
};
