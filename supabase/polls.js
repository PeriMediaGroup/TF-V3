import supabase from "./client";

const normalizeOptionList = (options) => {
  if (!Array.isArray(options)) return [];
  return options
    .map((opt) => {
      if (typeof opt === "string") {
        return opt.trim();
      }
      if (!opt) return "";
      if (typeof opt === "object" && typeof opt.label === "string") {
        return opt.label.trim();
      }
      return String(opt).trim();
    })
    .filter(Boolean);
};

export const createPollForPost = async ({
  postId,
  question,
  options,
  allowMulti = false,
  closesAt = null,
  userId,
}) => {
  const trimmedQuestion = (question || "").trim();
  const normalizedOptions = normalizeOptionList(options);

  if (!postId) throw new Error("Missing post id");
  if (!userId) throw new Error("Missing user id");
  if (!trimmedQuestion) throw new Error("Poll question is required");
  if (normalizedOptions.length < 2) {
    throw new Error("A poll needs at least two options");
  }

  const { data: existing, error: existingError } = await supabase
    .from("polls_app")
    .select("id")
    .eq("post_id", postId)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }
  if (existing) {
    throw new Error("Poll already exists for this post");
  }

  const insertPayload = {
    post_id: postId,
    question: trimmedQuestion,
    allow_multi: !!allowMulti,
    created_by: userId,
    closes_at: closesAt || null,
  };

  const { data: pollData, error: pollError } = await supabase
    .from("polls_app")
    .insert([insertPayload])
    .select("id")
    .single();

  if (pollError) throw pollError;

  try {
    const optionRows = normalizedOptions.map((label, idx) => ({
      poll_id: pollData.id,
      label,
      sort_order: idx,
    }));

    const { error: optionError } = await supabase
      .from("poll_options_app")
      .insert(optionRows);

    if (optionError) throw optionError;
  } catch (err) {
    await supabase.from("polls_app").delete().eq("id", pollData.id);
    throw err;
  }

  return pollData.id;
};

const parseOptionCounts = (pollRow) => {
  const options = Array.isArray(pollRow?.poll_options_app)
    ? pollRow.poll_options_app
    : [];

  const parsed = options
    .map((opt) => {
      const rawVotes = Array.isArray(opt?.option_votes)
        ? opt.option_votes
        : [];
      const countEntry =
        rawVotes.length === 1 && typeof rawVotes[0]?.count === "number"
          ? rawVotes[0]
          : null;
      const count = countEntry ? countEntry.count : rawVotes.length;
      return {
        id: opt.id,
        label: opt.label,
        sort_order: opt.sort_order ?? 0,
        count,
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);

  const totalVotes = parsed.reduce((sum, opt) => sum + (opt.count || 0), 0);

  return { options: parsed, totalVotes };
};

export const fetchPollByPostId = async ({ postId, userId }) => {
  if (!postId) return null;
  const { data, error } = await supabase
    .from("polls_app")
    .select(
      `
        id,
        question,
        allow_multi,
        closes_at,
        created_at,
        poll_options_app (
          id,
          label,
          sort_order,
          option_votes:poll_votes_app!poll_votes_app_option_id_fkey ( count )
        )
      `
    )
    .eq("post_id", postId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { options, totalVotes } = parseOptionCounts(data);

  let userVote = null;
  if (userId) {
    const { data: voteRow, error: voteError } = await supabase
      .from("poll_votes_app")
      .select("option_id")
      .eq("poll_id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!voteError && voteRow) {
      userVote = voteRow.option_id;
    }
  }

  return {
    id: data.id,
    postId,
    question: data.question,
    allowMulti: !!data.allow_multi,
    closesAt: data.closes_at,
    createdAt: data.created_at,
    options,
    totalVotes,
    userVote,
  };
};

export const fetchPollById = async ({ pollId, userId }) => {
  if (!pollId) return null;
  const { data, error } = await supabase
    .from("polls_app")
    .select(
      `
        id,
        post_id,
        question,
        allow_multi,
        closes_at,
        created_at,
        poll_options_app (
          id,
          label,
          sort_order,
          option_votes:poll_votes_app!poll_votes_app_option_id_fkey ( count )
        )
      `
    )
    .eq("id", pollId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { options, totalVotes } = parseOptionCounts(data);

  let userVote = null;
  if (userId) {
    const { data: voteRow, error: voteError } = await supabase
      .from("poll_votes_app")
      .select("option_id")
      .eq("poll_id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!voteError && voteRow) {
      userVote = voteRow.option_id;
    }
  }

  return {
    id: data.id,
    postId: data.post_id,
    question: data.question,
    allowMulti: !!data.allow_multi,
    closesAt: data.closes_at,
    createdAt: data.created_at,
    options,
    totalVotes,
    userVote,
  };
};

export const castPollVote = async ({ pollId, optionId, userId }) => {
  if (!pollId || !optionId) throw new Error("Missing poll/option id");
  if (!userId) throw new Error("Must be signed in to vote");

  const payload = { poll_id: pollId, option_id: optionId, user_id: userId };
  const { error } = await supabase
    .from("poll_votes_app")
    .upsert(payload, { onConflict: "poll_id,user_id" });
  if (error) throw error;
};

export const removePollVote = async ({ pollId, userId }) => {
  if (!pollId || !userId) return;
  const { error } = await supabase
    .from("poll_votes_app")
    .delete()
    .eq("poll_id", pollId)
    .eq("user_id", userId);
  if (error) throw error;
};

export const subscribeToPollVotes = (pollId, handler) => {
  if (!pollId) return { unsubscribe: () => {} };

  const channel = supabase
    .channel(`poll-votes-${pollId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "poll_votes_app",
        filter: `poll_id=eq.${pollId}`,
      },
      handler
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
};
