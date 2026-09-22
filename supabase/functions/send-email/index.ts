import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { recipient_id, subject, message } = await req.json();

    if (!recipient_id || !subject || !message) {
      return new Response(JSON.stringify({ error: "Missing recipient_id, subject, or message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: recipient } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", recipient_id)
      .single();

    if (!recipient) {
      return new Response(JSON.stringify({ error: "Recipient not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error: notifError } = await adminClient
      .from("notifications")
      .insert({
        user_id: recipient_id,
        message: `📧 ${subject}\n\n${message}`,
        type: "email_response",
      });

    if (notifError) {
      throw notifError;
    }

    const { data: recipientAuth } = await adminClient.auth.admin.getUserById(recipient_id);

    if (recipientAuth?.user?.email) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "CJLink <noreply@cjlink.app>",
              to: [recipientAuth.user.email],
              subject: `[CJLink] ${subject}`,
              text: message,
            }),
          });
        } catch {
          // Email via Resend failed, but notification was still created
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to send email" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
