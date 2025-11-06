import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const buildAnonymizedEmail = () => {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 18);
  return `deleted_user_${random}@triggerfeed.invalid`;
};

const buildAnonymizedUsername = () => {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `Deleted_User_${random}`;
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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: { Authorization: authHeader },
    },
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, profile_image_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("delete_user_account: profile lookup failed", profileError);
    return new Response(
      JSON.stringify({ error: "Failed to load profile." }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  if (!profile) {
    return new Response(JSON.stringify({ error: "Profile not found." }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const anonymizedEmail = buildAnonymizedEmail();

  const updatePayload: Record<string, unknown> = {
    username: buildAnonymizedUsername(),
    first_name: null,
    last_name: null,
    about: null,
    email: anonymizedEmail,
    city: null,
    state: null,
    profile_image_url: null,
    banner_url: null,
    top_guns: [],
    top_friends: [],
    is_deleted: true,
  };

  let updateError = null;
  let attempts = 0;

  while (attempts < 5) {
    attempts += 1;
    updatePayload.username = buildAnonymizedUsername();
    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (!error) {
      updateError = null;
      break;
    }

    if (error.code === "23505" && attempts < 5) {
      continue;
    }

    updateError = error;
    break;
  }

  if (updateError) {
    console.error("delete_user_account: update failed", updateError);
    return new Response(
      JSON.stringify({ error: "Failed to anonymize account." }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  if (profile?.profile_image_url) {
    try {
      const { error: queueError } = await supabase
        .from("cloudinary_delete_queue")
        .insert({
          user_id: user.id,
          asset_url: profile.profile_image_url,
          requested_at: new Date().toISOString(),
        });
      if (queueError) {
        console.error("delete_user_account: queue cloudinary delete failed", queueError);
      }
    } catch (err) {
      console.error("delete_user_account: queue insertion exception", err);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
});
