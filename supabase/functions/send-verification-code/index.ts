import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Missing phone number" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if phone exists in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", phone)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "No account found with that phone number." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store in verification_codes table
    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({ phone, code, expires_at: expiresAt });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to store verification code." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // TODO: Integrate SMS provider (Twilio, etc.) here
    // For now, the code is stored and can be viewed in the DB.
    // In production, send via SMS:
    //   await sendSms(phone, `Your Lokal verification code is: ${code}`);

    console.log(`[DEV] Verification code for ${phone}: ${code}`);

    return new Response(
      JSON.stringify({
        message: "Verification code sent.",
        // Remove in production — only for dev convenience
        _dev_code: code,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
