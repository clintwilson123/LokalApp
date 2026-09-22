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
    // True connectivity failure
    if (
      error.name === "FunctionsFetchError" ||
      error.message?.includes("Failed to send a request") ||
      error instanceof TypeError
    ) {
      throw new Error("Could not reach the server. Please check your connection and try again.");
    }
    // Prefer structured body error when available
    let body = data;
    if (!body && typeof error.context?.json === "function") {
      try {
        body = await error.context.json();
      } catch {
        // body already consumed
      }
    }
    if (!body && error.message) {
      try {
        body = JSON.parse(error.message);
      } catch {
        // not JSON
      }
    }
    throw new Error(body?.error || body?.message || error.message || "Failed to send a request to the Edge Function");
  }
  return data;
}
