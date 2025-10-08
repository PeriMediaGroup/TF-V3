import { useCallback } from "react";
import supabase from "../supabase/client";
import { useAuth } from "../auth/AuthContext";
import { parseMentions as parseMentionTokens } from "../utils/parseMentions";

/**
 * Hook that returns a function to notify mentioned users via the notifications table.
 * @returns {(params:{mentions:string[]|string, fromUserId:string, postId?:string, commentId?:string}) => Promise<void>}
 */
export const useMentionNotifier = () => {
  const { profile } = useAuth();

  return useCallback(
    async ({ mentions, fromUserId, postId = null, commentId = null }) => {
      if (!fromUserId) return;

      const rawList = Array.isArray(mentions) ? mentions : parseMentionTokens(mentions);
      const candidateMap = new Map();
      for (const value of rawList) {
        const trimmed = String(value || "").replace(/^@/, "").trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (!candidateMap.has(key)) {
          candidateMap.set(key, trimmed);
        }
      }

      if (!candidateMap.size) return;

      const filterValues = Array.from(candidateMap.values());

      try {
        let query = supabase
          .from("profiles")
          .select("id, username");

        if (filterValues.length === 1) {
          query = query.ilike("username", filterValues[0]);
        } else {
          const orFilter = filterValues
            .map((username) => `username.ilike.${username}`)
            .join(",");
          query = query.or(orFilter);
        }

        const { data: users, error } = await query;

        if (error) {
          console.error("useMentionNotifier lookup error:", error);
          return;
        }

        if (!users?.length) return;

        const fromUsername = profile?.username ? String(profile.username) : null;
        const notifications = users
          .filter((u) => u?.id && u.id !== fromUserId)
          .map((u) => ({
            user_id: u.id,
            type: "mention",
            data: {
              post_id: postId,
              comment_id: commentId,
              from_user_id: fromUserId,
              from_username: fromUsername,
              username: fromUsername,
            },
            is_read: false,
          }));

        if (!notifications.length) return;

        const { error: insertError } = await supabase.from("notifications").insert(notifications);
        if (insertError) {
          console.error("useMentionNotifier insert error:", insertError);
        }
      } catch (err) {
        console.error("useMentionNotifier unexpected error:", err);
      }
    },
    [profile?.username]
  );
};

export default useMentionNotifier;
