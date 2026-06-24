import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SupabaseClient = ReturnType<typeof createClient>;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalizeReason = (reason?: unknown) => {
  if (!reason) return null;
  const str = String(reason ?? "").trim();
  if (!str) return null;
  return str.slice(0, 500);
};

const parseAdminEmails = () => {
  const raw = Deno.env.get("ADMIN_EMAILS") ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

const isAdminUser = (user: any) => {
  if (!user) return false;
  const adminEmails = parseAdminEmails();
  const email = (user.email || "").toLowerCase();
  if (email && adminEmails.includes(email)) return true;

  const roles: string[] = [];
  const metaRoles =
    (user.app_metadata && (user.app_metadata.roles || user.app_metadata.role)) ||
    (user.user_metadata && (user.user_metadata.roles || user.user_metadata.role));

  if (Array.isArray(metaRoles)) {
    roles.push(...metaRoles);
  } else if (metaRoles) {
    roles.push(metaRoles);
  }

  const role = user.role || user.app_metadata?.role || user.user_metadata?.role;
  if (role) roles.push(role);

  return roles.some((r) => {
    const val = String(r || "").toLowerCase();
    return val === "admin" || val === "ceo";
  });
};

const sendModerationNotice = async (
  supabase: SupabaseClient,
  {
    userId,
    postId,
    commentId,
    reason,
  }: { userId: string; postId?: string | null; commentId?: string | null; reason?: string | null },
) => {
  const message = `Your ${commentId ? "comment" : "post"} was removed: ${reason || "violated our guidelines"}`;
  const payload = {
    user_id: userId,
    type: "moderation_delete",
    data: { message, post_id: postId ?? null, comment_id: commentId ?? null, reason: reason ?? null },
    is_read: false,
  };
  const { error } = await supabase.from("notifications").insert([payload]);
  if (error) throw error;
  return true;
};

const recordDeletion = async (
  supabase: SupabaseClient,
  {
    postId,
    actorId,
    ownerId,
    title,
    description,
    reason,
  }: { postId: string; actorId: string; ownerId: string; title?: string | null; description?: string | null; reason?: string | null },
) => {
  const payload = {
    post_id: postId,
    deleted_by: actorId,
    user_id: ownerId,
    title: title ?? null,
    description: description ?? null,
    deleted_at: new Date().toISOString(),
    reason: reason ?? null,
  };
  await supabase.from("post_deletions").delete().eq("post_id", postId);
  await supabase.from("post_deletions").insert([payload]);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server not configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = isAdminUser(user);
  const actorId = user.id;
  const action = body?.action;

  const reason = normalizeReason(body?.reason);

  const deletePost = async () => {
    const postId = body?.postId;
    const reportId = body?.reportId ?? null;
    if (!postId) return jsonResponse({ error: "postId is required" }, 400);

    const { data: post, error } = await supabase
      .from("posts")
      .select("id, user_id, title, description")
      .eq("id", postId)
      .maybeSingle();

    if (error) return jsonResponse({ error: error.message }, 500);
    if (!post) return jsonResponse({ error: "Post not found" }, 404);

    const owner = post.user_id;
    const canDelete = admin || actorId === owner;
    if (!canDelete) return jsonResponse({ error: "Forbidden" }, 403);

    // clear any pending reports to avoid FK errors
    await supabase.from("reports").delete().eq("post_id", postId).catch(() => {});

    const { error: delErr } = await supabase.from("posts").delete().eq("id", postId);
    if (delErr) return jsonResponse({ error: delErr.message }, 500);

    if (reportId) {
      await supabase.from("reports").delete().eq("id", reportId).catch(() => {});
    }

    let noticeSent = false;
    if (admin && actorId !== owner) {
      try {
        await sendModerationNotice(supabase, { userId: owner, postId, reason });
        noticeSent = true;
      } catch (e) {
        console.warn("[moderate-delete] notice failed", e?.message || e);
      }
      try {
        await recordDeletion(supabase, {
          postId,
          actorId,
          ownerId: owner,
          title: post.title,
          description: post.description,
          reason,
        });
      } catch (e) {
        console.warn("[moderate-delete] recordDeletion failed", e?.message || e);
      }
    }

    return jsonResponse({ success: true, noticeSent });
  };

  const deleteComment = async () => {
    const commentId = body?.commentId;
    const postId = body?.postId ?? null;
    const reportId = body?.reportId ?? null;
    if (!commentId) return jsonResponse({ error: "commentId is required" }, 400);

    const { data: comment, error } = await supabase
      .from("comments")
      .select("id, user_id, post_id")
      .eq("id", commentId)
      .maybeSingle();

    if (error) return jsonResponse({ error: error.message }, 500);
    if (!comment) return jsonResponse({ error: "Comment not found" }, 404);

    const owner = comment.user_id;
    const canDelete = admin || actorId === owner;
    if (!canDelete) return jsonResponse({ error: "Forbidden" }, 403);

    await supabase.from("reports").delete().eq("comment_id", commentId).catch(() => {});

    const { error: delErr } = await supabase.from("comments").delete().eq("id", commentId);
    if (delErr) return jsonResponse({ error: delErr.message }, 500);

    if (reportId) {
      await supabase.from("reports").delete().eq("id", reportId).catch(() => {});
    }

    if (admin && actorId !== owner) {
      try {
        await sendModerationNotice(supabase, {
          userId: owner,
          postId: postId ?? comment.post_id ?? null,
          commentId,
          reason,
        });
      } catch (e) {
        console.warn("[moderate-delete] comment notice failed", e?.message || e);
      }
    }

    return jsonResponse({ success: true });
  };

  const resolveReport = async () => {
    const reportId = body?.reportId;
    if (!reportId) return jsonResponse({ error: "reportId is required" }, 400);
    if (!admin) return jsonResponse({ error: "Forbidden" }, 403);

    const { error } = await supabase.from("reports").delete().eq("id", reportId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ success: true });
  };

  if (action === "delete_post") return await deletePost();
  if (action === "delete_comment") return await deleteComment();
  if (action === "resolve_report") return await resolveReport();

  return jsonResponse({ error: "Unknown action" }, 400);
});
