import React, { forwardRef, useCallback, useMemo } from "react";
import { FlatList, RefreshControl } from "react-native";
import PostCard, { arePostsStructurallyEqual } from "./PostCard";

const INITIAL_RENDER_COUNT = 8;
const MAX_TO_RENDER_PER_BATCH = 6;
const UPDATE_BATCHING_PERIOD_MS = 60;
const WINDOW_SIZE = 9;

const BASE_ITEM_HEIGHT = 220;
const MEDIA_ITEM_HEIGHT = 260;
const POLL_ITEM_HEIGHT = 220;
const TEXT_LINE_HEIGHT = 18;
const AVG_CHAR_PER_LINE = 42;

const stripLinks = (value) => String(value || "").replace(/https?:\/\/\S+/gi, "");

const estimateTextHeight = (value) => {
  const sanitized = stripLinks(value).trim();
  if (!sanitized) return 0;
  const lines = Math.max(1, Math.ceil(sanitized.length / AVG_CHAR_PER_LINE));
  return lines * TEXT_LINE_HEIGHT;
};

const hasMediaAttachment = (post) => {
  if (!post) return false;
  if (post.image_url || post.gif_url || post.video_url) return true;
  if (Array.isArray(post.post_images) && post.post_images.length) return true;
  return false;
};

const hasPollAttachment = (post) => Array.isArray(post?.polls_app) && post.polls_app.length > 0;

const estimatePostHeight = (post) => {
  let estimate = BASE_ITEM_HEIGHT;
  estimate += estimateTextHeight(post?.title);
  estimate += estimateTextHeight(post?.description);
  if (hasMediaAttachment(post)) {
    estimate += MEDIA_ITEM_HEIGHT;
  }
  if (hasPollAttachment(post)) {
    estimate += POLL_ITEM_HEIGHT;
  }
  return Math.min(900, Math.max(280, estimate));
};

const PostListComponent = forwardRef(function PostListComponent(
  {
    posts,
    user,
    onDeleted,
    onUpdated,
    onEndReached,
    refreshing,
    onRefresh,
    footerComponent,
    contentContainerStyle,
    refreshTintColor = "#B22222",
  },
  ref
) {
  const memoizedUser = useMemo(() => {
    if (user?.id) return { id: user.id };
    return null;
  }, [user?.id]);

  const keyExtractor = useCallback(
    (item, index) => (item?.id != null ? String(item.id) : `post-${index}`),
    []
  );

  const layoutMap = useMemo(() => {
    let offset = 0;
    return posts.map((post) => {
      const length = estimatePostHeight(post);
      const next = { length, offset };
      offset += length;
      return next;
    });
  }, [posts]);

  const getItemLayout = useCallback(
    (_data, index) => {
      const cached = layoutMap[index];
      if (cached) {
        return { length: cached.length, offset: cached.offset, index };
      }
      return { length: BASE_ITEM_HEIGHT, offset: BASE_ITEM_HEIGHT * index, index };
    },
    [layoutMap]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <PostCard post={item} user={memoizedUser} onDeleted={onDeleted} onUpdated={onUpdated} />
    ),
    [memoizedUser, onDeleted, onUpdated]
  );

  return (
    <FlatList
      ref={ref}
      data={posts}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      initialNumToRender={INITIAL_RENDER_COUNT}
      maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
      updateCellsBatchingPeriod={UPDATE_BATCHING_PERIOD_MS}
      windowSize={WINDOW_SIZE}
      scrollEventThrottle={16}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={footerComponent || null}
      contentContainerStyle={contentContainerStyle}
      refreshControl={
        onRefresh
          ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={refreshTintColor}
            />
          )
          : undefined
      }
    />
  );
});

const arePostListsEqual = (prevProps, nextProps) => {
  if ((prevProps.user?.id ?? null) !== (nextProps.user?.id ?? null)) return false;
  if (prevProps.refreshing !== nextProps.refreshing) return false;
  if (prevProps.onEndReached !== nextProps.onEndReached) return false;
  if (prevProps.onRefresh !== nextProps.onRefresh) return false;
  if (prevProps.onDeleted !== nextProps.onDeleted) return false;
  if (prevProps.onUpdated !== nextProps.onUpdated) return false;
  if (prevProps.footerComponent !== nextProps.footerComponent) return false;
  if (prevProps.contentContainerStyle !== nextProps.contentContainerStyle) return false;
  const prevPosts = prevProps.posts || [];
  const nextPosts = nextProps.posts || [];
  if (prevPosts === nextPosts) return true;
  if (prevPosts.length !== nextPosts.length) return false;
  for (let i = 0; i < prevPosts.length; i += 1) {
    if (!arePostsStructurallyEqual(prevPosts[i], nextPosts[i])) {
      return false;
    }
  }
  return true;
};

export default React.memo(PostListComponent, arePostListsEqual);
