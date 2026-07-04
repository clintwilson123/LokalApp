import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function callEdgeFunction(name, payload = {}) {
  const { data, error } = await supabase.functions.invoke(name, {
    body: payload,
  });
  if (error) {
    if (typeof error.context?.json === "function") {
      const body = await error.context.json();
      throw new Error(body.error || body.message || error.message);
    }
    throw new Error(error.message || "Failed to send a request to the Edge Function");
  }
  return data;
}
