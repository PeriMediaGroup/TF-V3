import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../styles/ThemeContext";
import supabase from "../../supabase/client";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import MentionsText from "../common/MentionsText";
import ReasonModal from "../common/ReasonModal";
import FlagPostModal from "./FlagPostModal";
import { moderateDeleteComment, flagPost } from "../../supabase/helpers";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export default function Comment({ comment, index, onDeleted }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const isElevated = user && (user?.role === "admin" || user?.role === "ceo");
  const isOwner = user && comment.user_id === user.id;
  const [reasonVisible, setReasonVisible] = React.useState(false);
  const [flagVisible, setFlagVisible] = React.useState(false);

  const handleDelete = () => {
    Alert.alert("Delete Comment", "Are you sure you want to delete this comment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            let query = supabase.from("comments").delete().eq("id", comment.id);
            if (!isElevated) {
              // restrict to own comment unless elevated
              query = query.eq("user_id", user.id);
            }
            const { error } = await query;

            if (error) {
              console.error("Error deleting comment:", error);
            } else {
              onDeleted?.(comment.id);
            }
          } catch (err) {
            console.error("Delete failed:", err.message);
          }
        },
      },
    ]);
  };

  const handleDeleteWithReason = async (reasonText) => {
    try {
      await moderateDeleteComment({
        commentId: comment.id,
        postId: comment.post_id,
        deletedBy: user.id,
        userId: comment.user_id,
        reason: reasonText || 'Removed by moderation',
      });
      onDeleted?.(comment.id);
    } catch (e) {
      console.error('Delete with reason failed:', e.message);
    }
  };

  return (
    <View
      style={[
        styles.comment,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.headerRow}>
        {comment.profiles?.profile_image_url ? (
          <Image source={{ uri: comment.profiles.profile_image_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.cardSoft }]} />
        )}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[styles.username, { color: theme.text }]}>
            {comment.profiles?.username || "Unknown"}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <MentionsText
          text={comment.text ?? comment.content ?? ""}
          style={[styles.text, { color: theme.text }]}
          mentionStyle={{ color: theme.primary }}
        />
        <Text style={[styles.timestamp, { color: theme.muted }]}>
          {dayjs.utc(comment.created_at).local().fromNow()}
        </Text>

        <View style={styles.actionsRow}>
          {!isOwner && !!user && (
            <TouchableOpacity
              onPress={() => setFlagVisible(true)}
              style={styles.iconBtn}
              accessibilityLabel="Report comment"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="flag-outline" size={16} color={theme.muted} />
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity onPress={handleDelete} style={styles.iconBtn} accessibilityLabel="Delete comment">
              <Ionicons name="trash-outline" size={16} color="red" />
            </TouchableOpacity>
          )}
          {isElevated && !isOwner && (
            <TouchableOpacity onPress={() => setReasonVisible(true)} style={styles.actionBtn}>
              <Text style={styles.deleteText}>Delete (reason)</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <ReasonModal
        visible={reasonVisible}
        title="Reason for removal"
        placeholder="Explain why this comment is removed"
        onCancel={() => setReasonVisible(false)}
        onSubmit={(txt) => { setReasonVisible(false); handleDeleteWithReason(txt); }}
      />
      <FlagPostModal
        visible={flagVisible}
        onCancel={() => setFlagVisible(false)}
        onSubmit={async (reason) => {
          setFlagVisible(false);
          try {
            await flagPost({ postId: comment.post_id, commentId: comment.id, userId: user?.id, reason });
          } catch {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  comment: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: "#ccc",
  },
  username: {
    fontFamily: "BlackOpsOne-Regular",
    fontSize: 14,
  },
  index: {
    marginRight: 6,
    fontWeight: "700",
  },
  content: {
    marginLeft: 40,
  },
  text: {
    fontSize: 14,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 6 },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  deleteText: {
    color: "red",
    fontSize: 12,
    fontWeight: "600",
  },
});
