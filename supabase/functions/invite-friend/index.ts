import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail =
    Deno.env.get("INVITE_FROM_EMAIL") ?? "Triggerfeed <no-reply@triggerfeed.com>";
  const inviteLinkBase =
    Deno.env.get("INVITE_LINK_BASE_URL") ?? "https://triggerfeed.com/signup";

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return new Response(
      JSON.stringify({ error: "Missing server configuration" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const payload = await req.json().catch(() => null);
  const targetEmail = typeof payload?.email === "string"
    ? payload.email.trim().toLowerCase()
    : "";

  if (!targetEmail) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(targetEmail)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), {
      status: 422,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const inviterName = typeof payload?.inviterName === "string" &&
      payload.inviterName.trim().length > 0
    ? payload.inviterName.trim()
    : user.user_metadata?.full_name ??
      user.user_metadata?.display_name ??
      user.email ??
      "A Triggerfeed friend";

  const customMessage = typeof payload?.message === "string"
      && payload.message.trim().length > 0
    ? payload.message.trim()
    : "";

  const link = inviteLinkBase.includes("?")
    ? `${inviteLinkBase}&email=${encodeURIComponent(targetEmail)}`
    : `${inviteLinkBase}?email=${encodeURIComponent(targetEmail)}`;

  const subject = `${inviterName} invited you to Triggerfeed`;
  const textBody = [
    `${inviterName} wants you to join them on Triggerfeed!`,
    customMessage,
    `Create your free account: ${link}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const htmlBody = `
    <p>${inviterName} wants you to join them on <strong>Triggerfeed</strong>!</p>
    ${customMessage ? `<p>${customMessage}</p>` : ""}
    <p><a href="${link}" style="color:#B22222;">Create your account</a> to hop in.</p>
  `;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [targetEmail],
      subject,
      text: textBody,
      html: htmlBody,
    }),
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    console.error("Resend error", errorText);
    return new Response(
      JSON.stringify({
        error: "Failed to send invite",
        details: errorText,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
});

