import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, LogBox, Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import supabase from "../supabase/client";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../styles/ThemeContext";
import PostList from "../components/posts/PostList";
import { arePostsStructurallyEqual } from "../components/posts/PostCard";
import PostSkeleton from "../components/posts/PostSkeleton";
import CreatePostFab from "../components/common/CreatePostFab";

const PAGE_SIZE = 10;
const FILTER_LABELS = {
  main: "Main",
  friends: "Friends",
  trending: "Trending",
};

const mergePostsPreservingIdentity = (previous = [], incoming = []) => {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return [];
  }
  const prevList = Array.isArray(previous) ? previous : [];
  const prevMap = new Map();
  prevList.forEach((post) => {
    if (post?.id != null) {
      prevMap.set(post.id, post);
    }
  });

  let mutated = prevList.length !== incoming.length;
  const next = incoming.map((post, idx) => {
    const id = post?.id;
    if (prevList[idx]?.id !== id) {
      mutated = true;
    }
    if (id == null) {
      mutated = true;
      return post;
    }
    const existing = prevMap.get(id);
    if (existing && arePostsStructurallyEqual(existing, post)) {
      return existing;
    }
    mutated = true;
    return post;
  });

  return mutated ? next : prevList;
};

const appendPostsPreservingIdentity = (previous = [], incoming = []) => {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return previous;
  }
  const prevList = Array.isArray(previous) ? previous : [];
  const result = prevList.slice();
  const indexMap = new Map();
  prevList.forEach((post, idx) => {
    if (post?.id != null) {
      indexMap.set(post.id, { post, idx });
    }
  });

  const seenIds = new Set(indexMap.keys());
  let mutated = false;

  incoming.forEach((post) => {
    const id = post?.id;
    if (id == null) {
      result.push(post);
      mutated = true;
      return;
    }
    const existing = indexMap.get(id);
    if (!existing) {
      if (!seenIds.has(id)) {
        result.push(post);
        const newIndex = result.length - 1;
        indexMap.set(id, { post, idx: newIndex });
        seenIds.add(id);
        mutated = true;
      }
      return;
    }
    if (!arePostsStructurallyEqual(existing.post, post)) {
      result[existing.idx] = post;
      indexMap.set(id, { post, idx: existing.idx });
      mutated = true;
    }
  });

  return mutated ? result : previous;
};

export default function FeedScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const route = useRoute();
  const insets = useSafeAreaInsets();
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
  const memoizedUser = useMemo(() => (user?.id ? { id: user.id } : null), [user?.id]);

  useEffect(() => {
    LogBox.ignoreLogs(["VirtualizedList: You have a large list that is slow to update"]);
  }, []);

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
      setPosts((prev) => mergePostsPreservingIdentity(prev, first));
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
      } catch (_err) {
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
      contentContainerStyle={listContentStyle}
      renderItem={() => <PostSkeleton />}
    />
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={theme.primary} />
        </View>
      );
    }
    if (!hasMore && posts.length) {
      return (
        <View style={styles.footer}>
          <Text style={[styles.meta, { color: theme.muted }]}>No more posts</Text>
        </View>
      );
    }
    return null;
  }, [hasMore, loadingMore, posts.length, theme.muted, theme.primary]);

  const handleRemovePost = useCallback((id) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const isPostVisibleInFilter = useCallback(
    (postData) => {
      if (!postData) return false;
      if (filter === "main") {
        return postData.visibility === "public";
      }
      if (filter === "friends") {
        if (postData.visibility !== "friends") return false;
        if (!user?.id) return false;
        const isFriend = friendIdList.some((id) => String(id) === String(postData.user_id));
        return isFriend || String(postData.user_id) === String(user.id);
      }
      if (filter === "trending") {
        if (postData.visibility === "public") return true;
        if (postData.visibility === "friends") {
          if (!user?.id) return false;
          const isFriend = friendIdList.some((id) => String(id) === String(postData.user_id));
          return isFriend || String(postData.user_id) === String(user.id);
        }
        return false;
      }
      return true;
    },
    [filter, friendIdList, user?.id]
  );

  const handlePostUpdated = useCallback(
    (updatedPost) => {
      if (!updatedPost?.id) return;
      setPosts((prev) => {
        const idx = prev.findIndex((p) => p.id === updatedPost.id);
        if (idx === -1) return prev;
        if (!isPostVisibleInFilter(updatedPost)) {
          const next = [...prev];
          next.splice(idx, 1);
          return next;
        }
        const merged = { ...prev[idx], ...updatedPost };
        if (arePostsStructurallyEqual(prev[idx], merged)) {
          return prev;
        }
        const next = [...prev];
        next[idx] = merged;
        return next;
      });
    },
    [isPostVisibleInFilter]
  );

  const onSelectFilter = (next) => {
    if (filter === next) return;
    setFilter(next);
    setPosts([]);
    setHasMore(true);
    setPage(0);
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  };

  const filterBarTop = 8;
  const filterBarHeight = 44;
  const listPaddingTop = filterBarTop + filterBarHeight + 8;
  const listPaddingBottom = (insets.bottom || 0) + 140;

  const filterBar = (
    <View style={[styles.filterBarOverlay, { top: filterBarTop }]} pointerEvents="box-none">
      <View style={styles.filterBar} pointerEvents="box-none">
        {filterOptions.map((key) => {
          const active = filter === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.filterBtn,
                {
                  backgroundColor: active ? theme.primary : theme.card,
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
    </View>
  );

  const listContentStyle = useMemo(
    () => [styles.list, { paddingTop: listPaddingTop, paddingBottom: listPaddingBottom }],
    [listPaddingBottom, listPaddingTop]
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
      // de-dup and preserve referential equality where possible
      setPosts((prev) => appendPostsPreservingIdentity(prev, next));
      setHasMore(next.length === PAGE_SIZE);
      setPage((prev) => prev + 1);
    } catch (error) {
      console.error('loadMore failed:', error?.message || error);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {filterBar}
      {posts.length ? (
        <PostList
          ref={listRef}
          posts={posts}
          user={memoizedUser}
          onDeleted={handleRemovePost}
          onUpdated={handlePostUpdated}
          onEndReached={loadMore}
          refreshing={refreshing}
          onRefresh={onRefresh}
          footerComponent={listFooter}
          contentContainerStyle={listContentStyle}
          refreshTintColor={theme.primary}
        />
      ) : (
        <View style={styles.center}>
          <Text style={[styles.meta, { color: theme.muted }]}>No posts yet.</Text>
        </View>
      )}
      <CreatePostFab />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  meta: { color: "#666" },
  footer: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  filterBarOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 6,
    elevation: 6,
  },
  filterBar: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 12,
    paddingVertical: 5,
    columnGap: 6,
  },
  filterBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
