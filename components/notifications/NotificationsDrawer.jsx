// components/notifications/NotificationsDrawer.jsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../../supabase/client";
import { fetchFriendRelationship, respondToFriendRequest } from "../../supabase/helpers";
import { useAuth } from "../../auth/AuthContext";
import { Colors } from "../../styles/GlobalStyles";
import SideDrawer from "../common/SideDrawer";

export default function NotificationsDrawer({ visible, onClose }) {
  const { user, profile: authProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.length;
  const navigation = useNavigation();

  const safeJson = useCallback((val) => {
    if (!val) return null;
    if (typeof val === "object") return val;
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }, []);

  const formatMessage = useCallback((row) => {
    const d = safeJson(row.data);
    const from = d?.from_username || d?.username || d?.fromUser || "Someone";
    switch (row.type) {
      case "moderation_delete":
        return d?.message || "Your content was removed by an admin";
      case "friend_request":
        return `${from} sent you a friend request`;
      case "friend_accept":
        return `${from} accepted your friend request`;
      case "comment":
      case "comment_post":
        return `${from} commented on your post`;
      case "mention":
        return `${from} mentioned you in a comment`;
      case "upvote":
      case "like":
        return `${from} upvoted your post`;
      default:
        return d?.message || row.type || "Notification";
    }
  }, [safeJson]);

  const navigateFromNotification = (row) => {
    const d = safeJson(row.data) || {};
    const postId = d.post_id || d.postId || d.postID;
    if (postId) {
      navigation.navigate("Feed", {
        screen: "SinglePost",
        params: { postId, commentId: d.comment_id || d.commentId },
      });
      return;
    }
    const username = d.from_username || d.username;
    if (username) {
      navigation.navigate("Profile", { screen: "PublicProfile", params: { username } });
      return;
    }
    const fromUserId = d.from_user_id || d.user_id;
    if (fromUserId) {
      navigation.navigate("Profile", { screen: "PublicProfile", params: { userId: fromUserId } });
    }
  };

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(`id, user_id, type, data, is_read, created_at`)
        .eq("user_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const list = (data || []).map((row) => ({
        id: row.id,
        created_at: row.created_at,
        is_read: row.is_read,
        type: row.type,
        data: row.data,
        message: formatMessage(row),
      }));
      setNotifications(list);
    } catch (err) {
      console.error("Error loading notifications:", err.message);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, formatMessage]);

  const markOneRead = useCallback(async (id) => {
    if (!user?.id || !id) return;
    try {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    } catch (err) {
      console.error("Mark one read failed:", err.message);
      loadNotifications();
    }
  }, [user?.id, loadNotifications]);

  const markAllRead = useCallback(async () => {
    if (!user?.id || unreadCount === 0) return;
    try {
      setNotifications([]);
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
    } catch (err) {
      console.error("Mark all read failed:", err.message);
      loadNotifications();
    }
  }, [user?.id, unreadCount, loadNotifications]);

  const handleFriendRespond = useCallback(async (item, accept) => {
    const d = safeJson(item.data) || {};
    const fromUserId = d.from_user_id || d.user_id;
    if (!fromUserId || !user?.id) return;
    try {
      const relation = await fetchFriendRelationship(fromUserId, user.id);
      if (!relation.request && relation.status !== "incoming") {
        if (accept) {
          // If no pending record exists, create friendship explicitly.
          await supabase.from("friends").insert([
            { user_id: fromUserId, friend_id: user.id, status: "accepted" },
          ]);
        }
        await markOneRead(item.id);
        return;
      }

      const requesterId = relation.request?.requesterId || fromUserId;
      const receiverId = relation.request?.receiverId || user.id;

      const res = await respondToFriendRequest({
        requesterId,
        receiverId,
        accept,
        currentUserId: user.id,
        otherUserId: fromUserId,
        currentUsername: authProfile?.username || null,
      });

      if (!res.success && accept) {
        console.warn("handleFriendRespond accept fallback", res.error);
      }

      await markOneRead(item.id);
    } catch (e) {
      console.error("handleFriendRespond:", e.message || e);
      loadNotifications();
    }
  }, [user?.id, authProfile?.username, markOneRead, loadNotifications, safeJson]);

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible, loadNotifications]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("notifications-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => loadNotifications()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadNotifications]);

  return (
    <SideDrawer
      visible={visible}
      onClose={onClose}
      title="Notifications"
      contentStyle={styles.content}
    >
      <View style={styles.actionsBar}>
        <TouchableOpacity
          onPress={() => {
            onClose?.();
            navigation.navigate("Profile", { screen: "Notifications" });
          }}
          style={styles.actionLink}
        >
          <Ionicons name="list" size={16} color={Colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.actionLinkText}>View all</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={markAllRead}
          disabled={unreadCount === 0}
          style={[styles.actionLink, unreadCount === 0 && styles.actionLinkDisabled]}
        >
          <Ionicons name="checkmark-done" size={16} color={unreadCount === 0 ? "#aaa" : Colors.white} style={{ marginRight: 6 }} />
          <Text
            style={[styles.actionLinkText, unreadCount === 0 && styles.actionLinkTextDisabled]}
          >
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View>
          <View style={styles.skel} />
          <View style={styles.skel} />
          <View style={styles.skel} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.itemText}>No notifications</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => {
                markOneRead(item.id);
                navigateFromNotification(item);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.itemCol}>
                <Text style={styles.itemText}>{item.message}</Text>
                <Text style={[styles.itemText, { opacity: 0.6, fontSize: 12 }]}>
                  {new Date(item.created_at).toLocaleString()}
                  {item.is_read ? "" : "  ??? Unread"}
                </Text>
              </View>
              {item.type === "friend_request" ? (
                <View style={styles.friendActions}>
                  <TouchableOpacity
                    onPress={() => handleFriendRespond(item, true)}
                    style={[styles.itemAction, styles.approve]}
                  >
                    <Text style={styles.itemActionText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleFriendRespond(item, false)}
                    style={[styles.itemAction, styles.decline]}
                  >
                    <Text style={styles.itemActionText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                !item.is_read && (
                  <TouchableOpacity onPress={() => markOneRead(item.id)} style={styles.itemAction}>
                    <Text style={styles.itemActionText}>Mark read</Text>
                  </TouchableOpacity>
                )
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SideDrawer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  actionsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  actionLink: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionLinkDisabled: {
    opacity: 0.6,
  },
  actionLinkText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  actionLinkTextDisabled: {
    color: "#ccc",
  },
  empty: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#444",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  itemCol: {
    flexShrink: 1,
    flexGrow: 1,
    paddingRight: 8,
  },
  itemAction: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: Colors.crimson,
    borderRadius: 6,
    marginLeft: 8,
  },
  itemActionText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  itemText: {
    color: Colors.white,
    fontSize: 14,
  },
  friendActions: {
    flexDirection: "row",
  },
  approve: {
    backgroundColor: "#2e7d32",
    marginLeft: 0,
  },
  decline: {
    backgroundColor: "#8b0000",
  },
  skel: {
    height: 18,
    backgroundColor: "#444",
    borderRadius: 6,
    marginBottom: 10,
  },
});
