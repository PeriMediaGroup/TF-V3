import { useCallback, useEffect, useMemo, useState } from "react";
import {
  castPollVote,
  fetchPollById,
  fetchPollByPostId,
  removePollVote,
  subscribeToPollVotes,
} from "../supabase/polls";

export default function usePoll({ postId, pollId, userId }) {
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const effectivePollId = poll?.id || pollId || null;

  const load = useCallback(async () => {
    if (!postId && !pollId) {
      setPoll(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = pollId
        ? await fetchPollById({ pollId, userId })
        : await fetchPollByPostId({ postId, userId });
      setPoll(data);
      setError(null);
    } catch (err) {
      console.error("usePoll load error:", err?.message || err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [postId, pollId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!effectivePollId) return undefined;
    const { unsubscribe } = subscribeToPollVotes(effectivePollId, () => {
      load();
    });
    return () => {
      unsubscribe?.();
    };
  }, [effectivePollId, load]);

  const vote = useCallback(
    async (optionId) => {
      if (!effectivePollId) return;
      await castPollVote({ pollId: effectivePollId, optionId, userId });
      await load();
    },
    [effectivePollId, userId, load]
  );

  const revokeVote = useCallback(async () => {
    if (!effectivePollId || !userId) return;
    await removePollVote({ pollId: effectivePollId, userId });
    await load();
  }, [effectivePollId, userId, load]);

  const derived = useMemo(() => {
    if (!poll) return null;
    if (!Array.isArray(poll.options)) return poll;
    const total = poll.totalVotes || 0;
    const enrichedOptions = poll.options.map((opt) => ({
      ...opt,
      percentage:
        total > 0 ? Math.round((opt.count / total) * 100) : 0,
    }));
    return {
      ...poll,
      options: enrichedOptions,
      totalVotes: total,
    };
  }, [poll]);

  return {
    poll: derived,
    loading,
    error,
    refresh: load,
    vote,
    revokeVote,
  };
}
