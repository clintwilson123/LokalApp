import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { phone, code, new_password } = await req.json();

    if (!phone || !code || !new_password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, preferences")
      .eq("phone_number", phone)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "No account found with that phone number." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const storedCode = profile.preferences?.reset_code;
    if (!storedCode || storedCode !== code) {
      return new Response(
        JSON.stringify({ error: "Invalid code." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { reset_code: _, ...rest } = profile.preferences || {};
    const { error: clearError } = await supabase
      .from("profiles")
      .update({ preferences: rest })
      .eq("id", profile.id);

    if (clearError) {
      console.error("Failed to clear reset code:", clearError);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { password: new_password }
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update password." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Password updated successfully." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
