import supabase from "../supabase/client";

function deriveInviterName(inviter) {
  if (!inviter) return undefined;
  return (
    inviter.username ||
    inviter.user_metadata?.display_name ||
    inviter.user_metadata?.full_name ||
    inviter.email ||
    undefined
  );
}

export async function sendInviteEmail(toEmail, inviter) {
  const email = String(toEmail || "").trim().toLowerCase();
  if (!email) {
    return { success: false, error: "Missing email" };
  }

  try {
    const { data, error } = await supabase.functions.invoke("invite-friend", {
      body: {
        email,
        inviter: deriveInviterName(inviter),
      },
    });

    if (error) {
      console.error("invite-friend invocation failed:", error);
      return { success: false, error: error.message || "Invite failed" };
    }

    if (data?.success) {
      return { success: true };
    }

    return {
      success: false,
      error: data?.error || "Invite failed",
    };
  } catch (err) {
    console.error("Invite error:", err);
    return { success: false, error: err?.message || "Invite failed" };
  }
}

