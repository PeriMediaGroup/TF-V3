import { Alert } from "react-native";
import supabase from "./client";

export const getRankFromPostCount = (count = 0) => {
  if (count >= 50) return "Veteran";
  if (count >= 25) return "Sharpshooter";
  if (count >= 10) return "Operator";
  if (count >= 1) return "Rookie";
  return "Fresh Mag";
};

export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    Alert.alert("Signup Error", error.message);
    return { success: false, error: error.message };
  }
  return { success: true, user: data.user || data.session?.user };
};

export const logIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  // console.log("Login response:", { data, error });

  if (error) {
    Alert.alert("Login Error", error.message);
    return { success: false, error: error.message };
  }
  return { success: true, user: data.user || data.session?.user };
};

export const logOut = async () => {
  await supabase.auth.signOut();
};

export const fetchVoteCounts = async (postId, userId) => {
  // pull all vote rows for the post
  const { data, error } = await supabase
    .from("post_votes")
    .select("value")
    .eq("post_id", postId);

  if (error) {
    console.error("fetchVoteCounts:", error.message);
    return { up: 0, down: 0, userVote: null };
  }

  let up = 0;
  let down = 0;
  for (const row of data || []) {
    if (row.value === 1) up += 1;
    else if (row.value === -1) down += 1;
  }

  // user’s current vote
  const { data: me, error: meErr } = await supabase
    .from("post_votes")
    .select("value")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  const userVote = meErr ? null : me?.value === 1 ? "up" : me?.value === -1 ? "down" : null;

  return { up, down, userVote };
};

export const handleVote = async (postId, userId, type) => {
  // toggle this user’s vote for this post
  const voteValue = type === "up" ? 1 : -1;

  const { data: existing } = await supabase
    .from("post_votes")
    .select("id, value")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    if (existing.value === voteValue) {
      await supabase.from("post_votes").delete().eq("id", existing.id);
    } else {
      await supabase.from("post_votes").update({ value: voteValue }).eq("id", existing.id);
    }
  } else {
    await supabase.from("post_votes").insert([{ post_id: postId, user_id: userId, value: voteValue }]);
  }

  return fetchVoteCounts(postId, userId);
};

export const getCommentCount = async (postId) => {
  const { count, error } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);

  if (error) {
    console.error("getCommentCount:", error.message);
    return 0;
  }
  return count || 0;
};

export const fetchProfileStats = async (userId) => {
  if (!userId) {
    return { postCount: 0, friendCount: 0, rank: getRankFromPostCount(0) };
  }

  try {
    const postsRes = await supabase
      .from("posts")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (postsRes.error) {
      console.error("fetchProfileStats posts error:", postsRes.error);
      throw postsRes.error;
    }

    const postCount = postsRes.count || 0;
    let friendCount = 0;

    const { data: friendsData, error: friendsError } = await supabase
      .from("friends")
      .select("user_id, friend_id, status")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (friendsError) {
      console.error("fetchProfileStats friends error:", friendsError);
      throw friendsError;
    }

    if (Array.isArray(friendsData) && friendsData.length > 0) {
      const friendIds = new Set();
      for (const entry of friendsData) {
        if (!entry || entry.status !== "accepted") continue;
        const { user_id: uid, friend_id: fid } = entry;
        const otherId = uid === userId ? fid : uid;
        if (otherId) {
          friendIds.add(otherId);
        }
      }

      if (friendIds.size > 0) {
        const { data: activeProfiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id")
          .in("id", Array.from(friendIds))
          .eq("is_deleted", false);

        if (profilesError) {
          console.error("fetchProfileStats profile filter error:", profilesError);
          friendCount = friendIds.size;
        } else {
          friendCount = Array.isArray(activeProfiles) ? activeProfiles.length : 0;
        }
      }
    }

    return {
      postCount,
      friendCount,
      rank: getRankFromPostCount(postCount),
    };
  } catch (error) {
    console.error("fetchProfileStats:", error);
    const fallbackCount = 0;
    return {
      postCount: fallbackCount,
      friendCount: 0,
      rank: getRankFromPostCount(fallbackCount),
    };
  }
};

export const fetchFriendRelationship = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) {
    return { status: "none" };
  }
  if (currentUserId === targetUserId) {
    return { status: "self" };
  }

  try {
    const { data, error } = await supabase
      .from("friends")
      .select("user_id, friend_id, status")
      .or(
        `and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`
      )
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return { status: "none" };
    }

    const requesterId = data.user_id;
    const receiverId = data.friend_id;

    if (data.status === "accepted") {
      return { status: "friends", request: { requesterId, receiverId } };
    }

    if (data.status === "pending") {
      if (requesterId === currentUserId) {
        return { status: "outgoing", request: { requesterId, receiverId } };
      }
      return { status: "incoming", request: { requesterId, receiverId } };
    }

    return { status: "none" };
  } catch (error) {
    console.error("fetchFriendRelationship:", error);
    return { status: "none" };
  }
};

export const sendFriendRequest = async ({ fromUserId, toUserId, fromUsername = null }) => {
  if (!fromUserId || !toUserId || fromUserId === toUserId) {
    return { success: false, error: "invalid-users" };
  }

  try {
    const existing = await fetchFriendRelationship(fromUserId, toUserId);
    if (existing.status === "friends") {
      return { success: false, error: "already-friends", request: existing.request };
    }
    if (existing.status === "outgoing" || existing.status === "incoming") {
      return { success: false, error: existing.status, request: existing.request };
    }

    const { error: insertError } = await supabase
      .from("friends")
      .insert([
        {
          user_id: fromUserId,
          friend_id: toUserId,
          status: "pending",
        },
      ]);

    if (insertError) throw insertError;

    await supabase.from("notifications").insert([
      {
        user_id: toUserId,
        type: "friend_request",
        from_user_id: fromUserId,
        ref_id: null,
        data: {
          from_user_id: fromUserId,
          from_username: fromUsername,
        },
      },
    ]);

    return {
      success: true,
      request: { requesterId: fromUserId, receiverId: toUserId },
    };
  } catch (error) {
    console.error("sendFriendRequest:", error);
    return { success: false, error: error.message || "friend-request-failed" };
  }
};

export const respondToFriendRequest = async ({
  requesterId,
  receiverId,
  accept,
  currentUserId,
  otherUserId,
  currentUsername = null,
}) => {
  if (!requesterId || !currentUserId) {
    return { success: false, error: "missing-request" };
  }

  try {
    const { error } = await supabase
      .from("friends")
      .update({ status: accept ? "accepted" : "declined" })
      .or(
        `and(user_id.eq.${requesterId},friend_id.eq.${currentUserId}),and(user_id.eq.${currentUserId},friend_id.eq.${requesterId})`
      );

    if (error) throw error;

    if (accept && otherUserId) {
      await supabase.from("notifications").insert([
        {
          user_id: otherUserId,
          type: "friend_accept",
          from_user_id: currentUserId,
          ref_id: null,
          data: {
            from_user_id: currentUserId,
            from_username: currentUsername,
          },
        },
      ]);
    }

    return { success: true };
  } catch (err) {
    console.error("respondToFriendRequest:", err.message);
    return { success: false, error: err.message };
  }
};

export const sendModerationNotice = async ({ userId, postId, commentId, reason }) => {
  try {
    const message = `Your ${commentId ? 'comment' : 'post'} was removed: ${reason || 'violated our guidelines'}`;
    const payload = {
      user_id: userId,
      type: 'moderation_delete',
      data: { message, post_id: postId, comment_id: commentId, reason },
      is_read: false,
    };
    const { error } = await supabase.from('notifications').insert([payload]);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error('sendModerationNotice:', e.message);
    return { success: false, error: e.message };
  }
};

export const flagPost = async ({ postId, userId, reason, commentId = null }) => {
  try {
    const payload = {
      reported_by: userId,
      post_id: postId ?? null,
      comment_id: commentId ?? null,
      reason,
    };
    const { error } = await supabase.from('reports').insert([payload]);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error('flagPost:', e.message);
    return { success: false, error: e.message };
  }
};

export const recordPostDeletion = async ({ postId, deletedBy, userId, title, description, reason, deletedAt }) => {
  try {
    const payload = {
      post_id: postId,
      deleted_by: deletedBy,
      user_id: userId,
      title: title ?? null,
      description: description ?? null,
      deleted_at: deletedAt ?? new Date().toISOString(),
    };
    const { error } = await supabase.from('post_deletions').insert([{ ...payload, reason }]);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    // Silently ignore audit insert errors to avoid noisy logs during moderation
    return { success: false, error: e.message };
  }
};

export const resolveReport = async (reportId) => {
  try {
    const { error } = await supabase.from('reports').delete().eq('id', reportId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error('resolveReport:', e.message);
    return { success: false, error: e.message };
  }
};

export const moderateDeleteComment = async ({ commentId, postId, deletedBy, userId, reason }) => {
  try {
    // log to reports
    const { error: insErr } = await supabase.from('reports').insert([
      { reported_by: deletedBy, post_id: postId ?? null, comment_id: commentId, reason },
    ]);
    if (insErr) throw insErr;

    // delete comment
    const { error: delErr } = await supabase.from('comments').delete().eq('id', commentId);
    if (delErr) throw delErr;

    // notify user
    await sendModerationNotice({ userId, postId, commentId, reason });
    return { success: true };
  } catch (e) {
    console.error('moderateDeleteComment:', e.message);
    return { success: false, error: e.message };
  }
};
