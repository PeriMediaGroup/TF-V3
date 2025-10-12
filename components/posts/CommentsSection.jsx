// components/posts/CommentsSection.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../styles/ThemeContext";
import supabase from "../../supabase/client";
import Comment from "./Comment";
import { parseMentions } from "../../utils/parseMentions";
import { useMentionNotifier } from "../../hooks/useMentionNotifier";
import MentionInput from "../common/MentionInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// dayjs was unused here; removed.

export default function CommentsSection({ postId, onCommentCountChange, initialCommentId }) {
  const { user, profile: authProfile } = useAuth();
  const { theme } = useTheme();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef(null);
  const notifyMentions = useMentionNotifier();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardInset = Math.max(0, keyboardHeight - insets.bottom);
  const keyboardOffset = Platform.OS === "ios" ? insets.top + 48 : 0;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const handleShow = (event) => {
      const height = event?.endCoordinates?.height ?? 0;
      setKeyboardHeight(height);
    };

    const handleHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener(showEvent, handleShow);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .select(
          `*,
          profiles (username, profile_image_url)`
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const list = data || [];
      setComments(list);
      // notify parent about current count
      onCommentCountChange?.(list.length);
      // try to scroll to a specific comment if provided
      if (initialCommentId) {
        const idx = list.findIndex((c) => c.id === initialCommentId);
        if (idx >= 0 && listRef.current?.scrollToIndex) {
          setTimeout(() => {
            try { listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 }); } catch {}
          }, 100);
        }
      }
    } catch (err) {
      console.error("Error loading comments:", err.message);
    } finally {
      setLoading(false);
    }
  }, [postId, initialCommentId, onCommentCountChange]);

  const handleDeleted = (id) => {
    setComments((prev) => {
      const next = (prev || []).filter((c) => c.id !== id);
      onCommentCountChange?.(next.length);
      return next;
    });
  };

  const focusCommentInput = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
  }, []);
  const handleAddComment = async () => {
    const trimmed = newComment.trim();
    if (!trimmed || !user) return;

    setSubmitting(true);
    try {
      const mentions = parseMentions(trimmed);
      let insertedId = null;

      // First try writing to "comment"
      let response = await supabase
        .from("comments")
        .insert([
          { post_id: postId, user_id: user.id, text: trimmed },
        ])
        .select("id")
        .single();

      let insertError = response.error || null;
      if (response.data?.id) {
        insertedId = response.data.id;
      }

      if (insertError && /column .*text.* does not exist/i.test(insertError.message)) {
        const retry = await supabase
          .from("comments")
          .insert([
            { post_id: postId, user_id: user.id, content: trimmed },
          ])
          .select("id")
          .single();
        insertError = retry.error || null;
        if (retry.data?.id) insertedId = retry.data.id;
      }

      if (insertError) throw insertError;

      setNewComment("");
      loadComments(); // reload comments after posting

      if (mentions.length) {
        await notifyMentions({
          mentions,
          fromUserId: user.id,
          postId,
          commentId: insertedId || null,
        });
      }
    } catch (err) {
      console.error("Error adding comment:", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (postId) loadComments();
  }, [postId, loadComments]);

  // Realtime updates: refresh list on any comment change for this post
  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel("comments-section-" + postId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        () => loadComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, loadComments]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardOffset}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: theme.surface, paddingBottom: keyboardInset },
        ]}
      >
        <Text style={[styles.header, { color: theme.text }]}>Comments</Text>

        {loading ? (
          <View>
            <View style={{ height: 12, borderRadius: 6, backgroundColor: theme.cardSoft, marginBottom: 8, width: '80%' }} />
            <View style={{ height: 12, borderRadius: 6, backgroundColor: theme.cardSoft, marginBottom: 8, width: '60%' }} />
            <View style={{ height: 12, borderRadius: 6, backgroundColor: theme.cardSoft, marginBottom: 8, width: '70%' }} />
          </View>
        ) : comments.length === 0 ? (
          <Text style={{ color: theme.muted }}>No comments yet</Text>
        ) : (
          <FlatList
            ref={listRef}
            keyboardShouldPersistTaps="handled"
            data={comments}
            keyExtractor={(item, idx) =>
              (item?.id ?? `comment-${idx}`).toString()
            }
            renderItem={({ item, index }) => (
              <Comment comment={item} index={index} onDeleted={handleDeleted} />
            )}
            contentContainerStyle={{ paddingBottom: 80 + keyboardInset }}
            removeClippedSubviews
            initialNumToRender={8}
            windowSize={5}
          />
        )}

        {user && (
          <View style={[styles.inputRow, keyboardInset ? { paddingBottom: Math.max(0, keyboardInset - 16) } : null]}>
            <MentionInput
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Write a comment..."
              currentUsername={authProfile?.username}
              inputStyle={[
                styles.input,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  backgroundColor: theme.card,
                  marginBottom: 0,
                },
              ]}
              style={{ flex: 1, marginRight: 8 }}
              onFocus={focusCommentInput}
            />
            <Pressable
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={handleAddComment}
              disabled={submitting}
            >
              <Text style={{ color: theme.background, fontWeight: "700" }}>
                {submitting ? "..." : "Post"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  header: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    fontFamily: "BlackOpsOne-Regular",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
});
