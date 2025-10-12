import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Text, View, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import supabase from "../supabase/client";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../styles/ThemeContext";
import PostCard from "../components/posts/PostCard";
import PostSkeleton from "../components/posts/PostSkeleton";

const PAGE_SIZE = 10;
const FILTER_LABELS = {
  main: "Main",
  friends: "Friends",
  trending: "Trending",
};

export default function FeedScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const route = useRoute();
  const focusPostId = route?.params?.focusPostId;
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("main");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [friendIds, setFriendIds] = useState([]);
  const [friendsLoaded, setFriendsLoaded] = useState(!user?.id);
  const listRef = useRef(null);

  const filterOptions = useMemo(() => {
    if (user?.id) return ["main", "friends", "trending"];
    return ["main", "trending"];
  }, [user?.id]);

  const friendIdList = useMemo(() => {
    const ids = new Set(friendIds || []);
    if (user?.id) ids.add(user.id);
    return Array.from(ids);
  }, [friendIds, user?.id]);

  useEffect(() => {
    let isMounted = true;
    if (!user?.id) {
      setFriendIds([]);
      setFriendsLoaded(true);
      return;
    }
    setFriendsLoaded(false);
    const loadFriends = async () => {
      try {
        const { data: sent, error: sentError } = await supabase
          .from("friends")
          .select("friend_id")
          .eq("user_id", user.id)
          .eq("status", "accepted");
        const { data: received, error: receivedError } = await supabase
          .from("friends")
          .select("user_id")
          .eq("friend_id", user.id)
          .eq("status", "accepted");
        if (sentError || receivedError) {
          throw sentError || receivedError;
        }
        const collected = new Set();
        (sent || []).forEach((row) => collected.add(row.friend_id));
        (received || []).forEach((row) => collected.add(row.user_id));
        if (isMounted) setFriendIds(Array.from(collected));
      } catch (err) {
        console.error("loadFriends error:", err?.message || err);
        if (isMounted) setFriendIds([]);
      } finally {
        if (isMounted) setFriendsLoaded(true);
      }
    };
    loadFriends();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const fetchPage = useCallback(
    async (pageIndex, activeFilter) => {
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query;

      if (activeFilter === "friends") {
        if (!user?.id || !friendIdList.length) {
          return [];
        }
        query = supabase
          .from("posts")
          .select(
            `
            id,
            user_id,
            title,
            description,
            image_url,
            gif_url,
            video_url,
            visibility,
            created_at,
            sticky,
            profiles ( username, profile_image_url ),
            post_images ( id, url ),
            polls_app ( id )
          `
          )
          .in("user_id", friendIdList)
          .eq("visibility", "friends")
          .order("sticky", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, to);
      } else if (activeFilter === "trending") {
        let trendingQuery = supabase
          .from("post_trending_view")
          .select("id, user_id, visibility, score")
          .order("score", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (user?.id && friendIdList.length) {
          const joined = friendIdList.join(",");
          trendingQuery = trendingQuery.or(
            `visibility.eq.public,and(user_id.in.(${joined}),visibility.eq.friends)`
          );
        } else {
          trendingQuery = trendingQuery.eq("visibility", "public");
        }

        const { data: trendingRows, error: trendingError } = await trendingQuery;
        if (trendingError) throw trendingError;
        if (!trendingRows?.length) return [];

        const ids = trendingRows.map((row) => row.id);
        const idOrder = new Map(ids.map((id, idx) => [id, idx]));

        const { data: postsData, error: postsError } = await supabase
          .from("posts")
          .select(
            `
            id,
            user_id,
            title,
            description,
            image_url,
            gif_url,
            video_url,
            visibility,
            created_at,
            sticky,
            profiles ( username, profile_image_url ),
            post_images ( id, url ),
            polls_app ( id )
          `
          )
          .in("id", ids);

        if (postsError) throw postsError;

        const sorted = (postsData || []).sort(
          (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
        );

        // Attach trending score for potential UI use
        const scoreMap = new Map(trendingRows.map((row) => [row.id, row.score]));
        return sorted.map((post) => ({
          ...post,
          trending_score: scoreMap.get(post.id) ?? null,
        }));
      } else {
        query = supabase
          .from("posts")
          .select(
            `
            id,
            user_id,
            title,
            description,
            image_url,
            gif_url,
            video_url,
            visibility,
            created_at,
            sticky,
            profiles ( username, profile_image_url ),
            post_images ( id, url ),
            polls_app ( id )
          `
          )
          .eq("visibility", "public")
          .order("sticky", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    [friendIdList, user?.id]
  );

  const loadPosts = useCallback(async () => {
    if (user?.id && !friendsLoaded) {
      return;
    }
    try {
      if (!refreshing) setLoading(true);
      const first = await fetchPage(0, filter);
      setPosts(first);
      setHasMore(first.length === PAGE_SIZE);
      setPage(1);
    } catch (err) {
      console.error("Unexpected error loading posts:", err);
      setPosts([]);
      setHasMore(false);
      setPage(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPage, filter, friendsLoaded, refreshing, user?.id]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useFocusEffect(
    React.useCallback(() => {
      loadPosts();
    }, [loadPosts])
  );

  // Realtime posts: refresh on inserts/updates/deletes
  useEffect(() => {
    const channel = supabase
      .channel("posts-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => loadPosts()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPosts]);

  // Attempt to scroll to a specific post when requested
  useEffect(() => {
    if (!focusPostId || !posts?.length) return;
    const idx = posts.findIndex((p) => p.id === focusPostId);
    if (idx >= 0 && listRef.current) {
      try {
        listRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
      } catch (e) {
        // fallback: small timeout then try again
        setTimeout(() => {
          try { listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 }); } catch {}
        }, 300);
      }
    }
  }, [focusPostId, posts]);

  const renderSkeletons = () => (
    <FlatList
      data={Array.from({ length: 6 }, (_, i) => i)}
      keyExtractor={(i) => `skeleton-${i}`}
      contentContainerStyle={styles.list}
      renderItem={() => <PostSkeleton />}
    />
  );

  const handleRemovePost = useCallback((id) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const onSelectFilter = (next) => {
    if (filter === next) return;
    setFilter(next);
    setPosts([]);
    setHasMore(true);
    setPage(0);
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  };

  const filterBar = (
    <View style={[styles.filterBar]}>
      {filterOptions.map((key) => {
        const active = filter === key;
        return (
          <TouchableOpacity
            key={key}
            style={[
              styles.filterBtn,
              {
                backgroundColor: active ? theme.primary : "transparent",
                borderColor: active ? theme.primary : theme.border,
              },
            ]}
            onPress={() => onSelectFilter(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.filterText,
                { color: active ? theme.background : theme.text },
              ]}
            >
              {FILTER_LABELS[key]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        {filterBar}
        {renderSkeletons()}
      </View>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading || refreshing) return;
    setLoadingMore(true);
    try {
      const next = await fetchPage(page, filter);
      if (!next.length) {
        setHasMore(false);
        return;
      }
      // de-dup in case of race
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const n of next) if (!seen.has(n.id)) merged.push(n);
        return merged;
      });
      setHasMore(next.length === PAGE_SIZE);
      setPage((prev) => prev + 1);
    } catch (e) {
      console.error('loadMore failed:', e?.message || e);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {filterBar}
      {posts.length ? (
        <FlatList
          ref={listRef}
          data={posts}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <PostCard post={item} user={user} onDeleted={handleRemovePost} />
          )}
          keyExtractor={(item, idx) => (item?.id ?? `post-${idx}`).toString()}
          contentContainerStyle={styles.list}
          removeClippedSubviews
          initialNumToRender={6}
          windowSize={7}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color="#B22222" />
              </View>
            ) : !hasMore ? (
              <View style={styles.footer}>
                <Text style={styles.meta}>No more posts</Text>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#B22222"
            />
          }
        />
      ) : (
        <View style={styles.center}>
          <Text style={[styles.meta, { color: theme.muted }]}>No posts yet.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  meta: { color: "#666" },
  footer: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    columnGap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
