import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../styles/ThemeContext";
import supabase from "../supabase/client";
import { useNavigation } from "@react-navigation/native";

const PAGE_SIZE = 20;

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const safeJson = (val) => {
    if (!val) return null;
    if (typeof val === "object") return val;
    try { return JSON.parse(val); } catch { return null; }
  };

  const formatMessage = (row) => {
    const d = safeJson(row.data);
    const from = d?.from_username || d?.username || d?.fromUser || "Someone";
    switch (row.type) {
      case "friend_request":
        return `👤 ${from} sent you a friend request`;
      case "friend_accept":
        return `✅ ${from} accepted your friend request`;
      case "comment":
      case "comment_post":
        return `💬 ${from} commented on your post`;
      case "mention":
        return `@ ${from} mentioned you in a comment`;
      case "upvote":
      case "like":
        return `🔥 ${from} upvoted your post`;
      default:
        return d?.message || row.type || "Notification";
    }
  };

  const navigateFromNotification = (row) => {
    const d = safeJson(row.data) || {};
    const postId = d.post_id || d.postId || d.postID;
    if (postId) {
      navigation.navigate("Feed", { screen: "SinglePost", params: { postId, commentId: d.comment_id || d.commentId } });
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
      return;
    }
  };

  const baseQuery = () => {
    let q = supabase
      .from("notifications")
      .select("id, user_id, type, data, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1); // fetch one extra to detect more
    if (unreadOnly) q = q.eq("is_read", false);
    return q;
  };

  const loadInitial = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await baseQuery();
      if (error) throw error;
      const slice = (data || []).slice(0, PAGE_SIZE);
      setItems(slice.map((row) => ({ ...row, message: formatMessage(row) })));
      setHasMore((data || []).length > PAGE_SIZE);
    } catch (e) {
      console.error("Notifications loadInitial:", e.message);
      setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id, unreadOnly]);

  const loadMore = useCallback(async () => {
    if (!user?.id || loadingMore || !hasMore || !items.length) return;
    setLoadingMore(true);
    try {
      const cursor = items[items.length - 1].created_at;
      let q = baseQuery().lt("created_at", cursor);
      const { data, error } = await q;
      if (error) throw error;
      const slice = (data || []).slice(0, PAGE_SIZE);
      setItems((prev) => [...prev, ...slice.map((r) => ({ ...r, message: formatMessage(r) }))]);
      setHasMore((data || []).length > PAGE_SIZE);
    } catch (e) {
      console.error("Notifications loadMore:", e.message);
    } finally {
      setLoadingMore(false);
    }
  }, [user?.id, loadingMore, hasMore, items, unreadOnly]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  }, [loadInitial]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const markOneRead = async (id) => {
    try {
      setItems((prev) => prev.filter((n) => n.id !== id));
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    } catch (e) {
      console.error("markOneRead:", e.message);
      loadInitial();
    }
  };

  const markAllRead = async () => {
    try {
      setItems([]);
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
    } catch (e) {
      console.error("markAllRead:", e.message);
      loadInitial();
    }
  };

  const handleFriendRespond = async (item, accept) => {
    const d = safeJson(item.data) || {};
    const fromUserId = d.from_user_id;
    if (!fromUserId || !user?.id) return;
    try {
      const status = accept ? "accepted" : "declined";
      let { error } = await supabase
        .from("friend_requests")
        .update({ status })
        .eq("from_user_id", fromUserId)
        .eq("to_user_id", user.id);
      if (error && accept) {
        const tryFriends = await supabase
          .from("friends")
          .insert([
            { user_id: user.id, friend_id: fromUserId },
            { user_id: fromUserId, friend_id: user.id },
          ]);
        if (tryFriends.error) console.warn("friends insert fallback:", tryFriends.error.message);
      }
      await markOneRead(item.id);
    } catch (e) {
      console.error("handleFriendRespond:", e.message);
      onRefresh();
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => setUnreadOnly((v) => !v)} style={[styles.pill, unreadOnly && { backgroundColor: theme.primary }]}>
          <Text style={[styles.pillText, unreadOnly && { color: theme.background }]}>Unread only</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={markAllRead} style={styles.pill}>
          <Text style={styles.pillText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 12 }} /> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.row, { borderColor: theme.border }]} onPress={() => { markOneRead(item.id); navigateFromNotification(item); }}>
            <View style={styles.rowCol}>
              <Text style={[styles.rowText, { color: theme.text }]}>{item.message}</Text>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            {item.type === 'friend_request' ? (
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity onPress={() => handleFriendRespond(item, true)} style={[styles.pill, { backgroundColor: '#2e7d32' }]}>
                  <Text style={styles.pillText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleFriendRespond(item, false)} style={[styles.pill, { backgroundColor: '#8b0000', marginLeft: 8 }]}>
                  <Text style={styles.pillText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ) : (
              !item.is_read && (
                <Text style={[styles.unreadDot, { color: theme.primary }]}>•</Text>
              )
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerIcon: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSpacer: { width: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toolbar: { flexDirection: "row", justifyContent: "flex-end", padding: 12, gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#333" },
  pillText: { color: "#fff", fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCol: { flexShrink: 1, flexGrow: 1, paddingRight: 12 },
  rowText: { fontSize: 15, fontWeight: "600" },
  rowMeta: { fontSize: 12, marginTop: 2 },
  unreadDot: { fontSize: 24, lineHeight: 24 },
});
