import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  useWindowDimensions,
  Modal,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import YoutubePlayer from "react-native-youtube-iframe";
import { useNavigation } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../styles/ThemeContext";
import { useAuth } from "../../auth/AuthContext";
import {
  getCommentCount,
  flagPost,
  deletePostModeration,
} from "../../supabase/helpers";
import { showToast } from "../../utils/toast";
import supabase from "../../supabase/client";
import VoteButtons from "./VoteButtons";
import CommentsSection from "./CommentsSection";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import MentionsText from "../common/MentionsText";
import { hasYoutubeLink, extractYoutubeId } from "../../utils/linkifyText";
import AdminActionMenu from "./AdminActionMenu";
import ReasonModal from "../common/ReasonModal";
import FlagPostModal from "./FlagPostModal";
import EditPostModal from "./EditPostModal";
import PollModule from "../polls/PollModule";
import usePoll from "../../hooks/usePoll";
dayjs.extend(relativeTime);
dayjs.extend(utc);

const YOUTUBE_LINK_REGEX =
  /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=[^\s]+|youtu\.be\/[^\s]+)/gi;

const sanitizeTextContent = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (!hasYoutubeLink(raw)) return raw;
  const cleaned = raw
    .replace(YOUTUBE_LINK_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || null;
};

const isVideoUrl = (u) => {
  if (!u) return false;
  const lower = String(u).toLowerCase();
  const base = lower.split(/[?#]/)[0];
  if (base.includes("/video/upload")) return true; // cloudinary hint
  return (
    base.endsWith(".mp4") ||
    base.endsWith(".mov") ||
    base.endsWith(".m4v") ||
    base.endsWith(".webm")
  );
};

const isYouTubeUrl = (u) => {
  if (!u) return false;
  const s = String(u).toLowerCase();
  return (
    s.includes("youtube.com/watch") ||
    s.includes("youtu.be/") ||
    s.includes("youtube.com/embed/")
  );
};

const getYouTubeId = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    // https://www.youtube.com/watch?v=VIDEOID
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/watch")) return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/"))
        return u.pathname.split("/embed/")[1]?.split("/")[0];
      // shorts: /shorts/VIDEOID
      if (u.pathname.startsWith("/shorts/"))
        return u.pathname.split("/shorts/")[1]?.split("/")[0];
    }
    // https://youtu.be/VIDEOID
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace(/^\//, "").split("/")[0];
    }
  } catch {}
  return null;
};

const TF_ORIENTATION_PARAM = "tf_orientation";
const MEDIA_MAX_HEIGHT_RATIO = 0.99;
const MEDIA_MAX_HEIGHT_ABSOLUTE = 2000;
const MEDIA_MAX_WIDTH_RATIO = 0.96;
const VIDEO_SCREEN_HEIGHT_RATIO = .9;
const IMAGE_ZOOM_MAX_SCALE = 4;
const IMAGE_ZOOM_RESET_THRESHOLD = 1.02;
const IMAGE_SWIPE_THRESHOLD = 80;
const IMAGE_SWIPE_VELOCITY = 650;

const clampTranslateWorklet = (value, bound) => {
  "worklet";
  if (bound <= 0) return 0;
  if (value > bound) return bound;
  if (value < -bound) return -bound;
  return value;
};

const clampScaleWorklet = (value) => {
  "worklet";
  if (value < 1) return 1;
  if (value > IMAGE_ZOOM_MAX_SCALE) return IMAGE_ZOOM_MAX_SCALE;
  return value;
};

const parseOrientationFromUrl = (url) => {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    const raw = parsed.searchParams.get(TF_ORIENTATION_PARAM);

    if (raw == null) return null;

    const numeric = Number(raw);

    return Number.isNaN(numeric) ? null : numeric;
  } catch {
    return null;
  }
};

const stripOrientationParam = (url) => {
  if (!url) return url;

  try {
    const parsed = new URL(url);

    parsed.searchParams.delete(TF_ORIENTATION_PARAM);

    return parsed.toString();
  } catch {
    return url;
  }
};

const rotationForOrientation = (orientation) => {
  switch (orientation) {
    case ScreenOrientation.Orientation.LANDSCAPE_LEFT:
      return "90deg";
    case ScreenOrientation.Orientation.LANDSCAPE_RIGHT:
      return "-90deg";
    case ScreenOrientation.Orientation.PORTRAIT_DOWN:
      return "180deg";
    default:
      return "0deg";
  }
};

const aspectForOrientation = (orientation, fallback = 16 / 9) => {
  if (
    orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
    orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN
  ) {
    return 9 / 16;
  }

  if (
    orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
    orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
  ) {
    return 16 / 9;
  }

  return fallback;
};

const VideoItem = React.memo(function VideoItem({ url, ratio, mediaWidth }) {
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState(mediaWidth ?? null);
  const orientation = parseOrientationFromUrl(url);
  const playbackUrl = orientation !== null ? stripOrientationParam(url) : url;
  const player = useVideoPlayer({ uri: playbackUrl }, (p) => {
    p.loop = false;
  });
  const rawAspect = aspectForOrientation(orientation, ratio || 16 / 9);
  const containerAspect =
    Number.isFinite(rawAspect) && rawAspect > 0 ? rawAspect : 16 / 9;
  const rotate = rotationForOrientation(orientation);
  const maxHeight = Math.min(
    viewportHeight * MEDIA_MAX_HEIGHT_RATIO,
    MEDIA_MAX_HEIGHT_ABSOLUTE
  );
  const viewportMaxWidth = viewportWidth * MEDIA_MAX_WIDTH_RATIO;
  useEffect(() => {
    if (!mediaWidth) return;
    setAvailableWidth((prev) => {
      if (!prev) return mediaWidth;
      if (Math.abs(prev - mediaWidth) < 1) return prev;
      return mediaWidth;
    });
  }, [mediaWidth]);
  const surfaceStyle = useMemo(() => {
    const targetHeight = Math.min(
      maxHeight,
      viewportHeight * VIDEO_SCREEN_HEIGHT_RATIO
    );
    const maxUsableWidth = availableWidth ?? viewportMaxWidth;
    let height = targetHeight;
    let width = height * containerAspect;
    if (width > maxUsableWidth) {
      width = maxUsableWidth;
      height = width / containerAspect;
    }
    if (height > maxHeight) {
      height = maxHeight;
      width = height * containerAspect;
    }
    return { width, height };
  }, [availableWidth, containerAspect, maxHeight, viewportHeight, viewportMaxWidth]);
  const videoBaseStyle = useMemo(
    () => ({
      width: surfaceStyle.width,
      height: surfaceStyle.height,
    }),
    [surfaceStyle.height, surfaceStyle.width]
  );
  const videoStyle =
    rotate === "0deg"
      ? [videoBaseStyle]
      : [videoBaseStyle, { transform: [{ rotate }] }];
  const wrapperStyle = useMemo(() => {
    const dynamic = {
      width: surfaceStyle.width,
      height: surfaceStyle.height,
    };
    return [styles.mediaItemWrapperTight, dynamic];
  }, [surfaceStyle.height, surfaceStyle.width]);
  return (
    <View
      style={wrapperStyle}
      onLayout={(event) => {
        if (mediaWidth) return;
        const nextWidth = event?.nativeEvent?.layout?.width ?? 0;
        if (
          nextWidth > 0 &&
          Math.abs(nextWidth - (availableWidth ?? 0)) > 0.5 &&
          nextWidth >= (availableWidth ?? 0)
        ) {
          setAvailableWidth(nextWidth);
        }
      }}
    >
      <View style={[styles.videoSurface, surfaceStyle]}>
        <VideoView
          player={player}
          style={videoStyle}
          nativeControls
          contentFit="contain"
          resizeMode="contain"
        />
      </View>
    </View>
  );
});

const YouTubeItem = React.memo(function YouTubeItem({
  videoId,
  ratio = 16 / 9,
  autoplay,
}) {
  const { width } = useWindowDimensions();
  if (!videoId) return null;
  const playerWidth = Math.max(260, Math.min(width - 48, width));
  const playerHeight = Math.round(playerWidth / ratio);
  return (
    <View style={{ marginRight: 8, flex: 1 }}>
      <YoutubePlayer
        height={playerHeight}
        width={playerWidth}
        videoId={videoId}
        play={!!autoplay}
        initialPlayerParams={{ controls: true, modestbranding: true }}
        webViewProps={{
          allowsFullscreenVideo: true,
          mediaPlaybackRequiresUserAction: false,
          allowsInlineMediaPlayback: true,
        }}
      />
    </View>
  );
});

const ZoomableImage = React.memo(function ZoomableImage({
  uri,
  onSwipeLeft,
  onSwipeRight,
}) {
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const layoutWidth = useSharedValue(viewportWidth);
  const layoutHeight = useSharedValue(viewportHeight);

  useEffect(() => {
    layoutWidth.value = viewportWidth;
    layoutHeight.value = viewportHeight;
  }, [layoutHeight, layoutWidth, viewportHeight, viewportWidth]);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 150 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(0, { duration: 150 });
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [
    savedScale,
    savedTranslateX,
    savedTranslateY,
    scale,
    translateX,
    translateY,
    uri,
  ]);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          savedScale.value = scale.value;
        })
        .onUpdate((event) => {
          const next = clampScaleWorklet(savedScale.value * event.scale);
          scale.value = next;
        })
        .onEnd(() => {
          if (scale.value <= 1) {
            scale.value = withTiming(1);
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
            return;
          }
          const boundsX = Math.max(
            0,
            ((scale.value - 1) * layoutWidth.value) / 2
          );
          const boundsY = Math.max(
            0,
            ((scale.value - 1) * layoutHeight.value) / 2
          );
          translateX.value = withTiming(
            clampTranslateWorklet(translateX.value, boundsX)
          );
          translateY.value = withTiming(
            clampTranslateWorklet(translateY.value, boundsY)
          );
        }),
    [
      layoutHeight,
      layoutWidth,
      savedScale,
      savedTranslateX,
      savedTranslateY,
      scale,
      translateX,
      translateY,
    ]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(5)
        .onStart(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        })
        .onUpdate((event) => {
          if (scale.value > IMAGE_ZOOM_RESET_THRESHOLD) {
            const boundsX = Math.max(
              0,
              ((scale.value - 1) * layoutWidth.value) / 2
            );
            const boundsY = Math.max(
              0,
              ((scale.value - 1) * layoutHeight.value) / 2
            );
            translateX.value = clampTranslateWorklet(
              savedTranslateX.value + event.translationX,
              boundsX
            );
            translateY.value = clampTranslateWorklet(
              savedTranslateY.value + event.translationY,
              boundsY
            );
          }
        })
        .onEnd((event) => {
          if (scale.value <= IMAGE_ZOOM_RESET_THRESHOLD) {
            const shouldGoNext =
              typeof onSwipeLeft === "function" &&
              event.translationX <= -IMAGE_SWIPE_THRESHOLD &&
              Math.abs(event.velocityX) > IMAGE_SWIPE_VELOCITY;
            const shouldGoPrev =
              typeof onSwipeRight === "function" &&
              event.translationX >= IMAGE_SWIPE_THRESHOLD &&
              Math.abs(event.velocityX) > IMAGE_SWIPE_VELOCITY;
            if (shouldGoNext) {
              runOnJS(onSwipeLeft)();
              return;
            }
            if (shouldGoPrev) {
              runOnJS(onSwipeRight)();
              return;
            }
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
            return;
          }
          const boundsX = Math.max(
            0,
            ((scale.value - 1) * layoutWidth.value) / 2
          );
          const boundsY = Math.max(
            0,
            ((scale.value - 1) * layoutHeight.value) / 2
          );
          translateX.value = withTiming(
            clampTranslateWorklet(translateX.value, boundsX)
          );
          translateY.value = withTiming(
            clampTranslateWorklet(translateY.value, boundsY)
          );
        }),
    [
      layoutHeight,
      layoutWidth,
      onSwipeLeft,
      onSwipeRight,
      savedTranslateX,
      savedTranslateY,
      scale,
      translateX,
      translateY,
    ]
  );

  const gesture = useMemo(
    () => Gesture.Simultaneous(pinchGesture, panGesture),
    [panGesture, pinchGesture]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View
      style={styles.viewerImageWrapper}
      onLayout={(event) => {
        const { width, height } = event?.nativeEvent?.layout ?? {};
        if (width) layoutWidth.value = width;
        if (height) layoutHeight.value = height;
      }}
    >
      <GestureDetector gesture={gesture}>
        <Animated.Image
          source={{ uri }}
          style={[styles.viewerImage, animatedStyle]}
          resizeMode="contain"
        />
      </GestureDetector>
    </View>
  );
});

const MediaItem = React.memo(function MediaItem({ url, mediaWidth, onPress }) {
  const [ratio, setRatio] = useState(1);
  const [ytPlaying, setYtPlaying] = useState(false);
  const isVideo = isVideoUrl(url);

  useEffect(() => {
    let mounted = true;
    if (!url || isVideo) return;
    Image.getSize(
      url,
      (w, h) => mounted && w && h && setRatio(w / h),
      () => mounted && setRatio(1)
    );
    return () => {
      mounted = false;
    };
  }, [url, isVideo]);

  if (!url) return null;

  // YouTube preview with thumbnail, tap to play
  if (isYouTubeUrl(url)) {
    const vid = getYouTubeId(url);
    if (!ytPlaying) {
      const thumb = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
      return (
        <TouchableOpacity
          onPress={() => setYtPlaying(true)}
          activeOpacity={0.8}
          style={{ marginRight: 8, flex: 1 }}
        >
          <Image
            source={{ uri: thumb }}
            style={{
              width: "100%",
              height: undefined,
              aspectRatio: 16 / 9,
              borderRadius: 8,
            }}
            resizeMode="cover"
          />
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="play-circle" size={64} color="#ffffffcc" />
          </View>
        </TouchableOpacity>
      );
    }
    return <YouTubeItem videoId={vid} ratio={16 / 9} autoplay />;
  }

  if (isVideo) {
    return <VideoItem url={url} ratio={ratio} mediaWidth={mediaWidth} />;
  }

  const image = (
    <Image
      source={{ uri: url }}
      style={{
        width: "100%",
        height: undefined,
        aspectRatio: ratio || 1,
        borderRadius: 8,
      }}
      resizeMode="cover"
    />
  );

  if (typeof onPress === "function") {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{ marginRight: 8, flex: 1 }}
      >
        {image}
      </TouchableOpacity>
    );
  }

  return <View style={{ marginRight: 8, flex: 1 }}>{image}</View>;
});

function extractMediaUrls(post) {
  const urls = [];
  // From related post_images rows
  if (Array.isArray(post?.post_images)) {
    for (const item of post.post_images) {
      const u = item?.url || item?.image_url || item?.uri;
      if (u && !urls.includes(u)) urls.push(u);
    }
  }
  // Fallback single media fields on the post
  if (post?.image_url && !urls.includes(post.image_url))
    urls.push(post.image_url);
  if (post?.gif_url && !urls.includes(post.gif_url)) urls.push(post.gif_url);
  if (post?.video_url && !urls.includes(post.video_url))
    urls.push(post.video_url);
  // Detect YouTube links in title/description text
  try {
    const txt = [post?.title, post?.description].filter(Boolean).join(" \n ");
    if (hasYoutubeLink(txt)) {
      const vid = extractYoutubeId(txt);
      if (vid) {
        const y = `https://youtu.be/${vid}`;
        if (!urls.includes(y)) urls.push(y);
      }
    }
  } catch {}
  return urls;
}

const SCALAR_POST_FIELDS = [
  "id",
  "title",
  "description",
  "created_at",
  "updated_at",
  "sticky",
  "visibility",
  "image_url",
  "gif_url",
  "video_url",
  "trending_score",
  "votes",
  "vote_status",
  "comments_count",
  "comment_count",
  "likes_count",
  "reposts_count",
  "shares_count",
];

const normalizeValue = (value) => (value === undefined ? null : value);

const areProfilesEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return (
    normalizeValue(a.username) === normalizeValue(b.username) &&
    normalizeValue(a.profile_image_url) === normalizeValue(b.profile_image_url)
  );
};

const normalizeMediaEntry = (entry) => {
  if (!entry) return { id: null, url: null };
  return {
    id: entry.id != null ? String(entry.id) : null,
    url: entry.url || entry.image_url || entry.uri || null,
  };
};

const areImagesEqual = (a, b) => {
  const arrA = Array.isArray(a) ? a.map(normalizeMediaEntry) : [];
  const arrB = Array.isArray(b) ? b.map(normalizeMediaEntry) : [];
  if (arrA.length !== arrB.length) return false;
  for (let idx = 0; idx < arrA.length; idx += 1) {
    const left = arrA[idx];
    const right = arrB[idx];
    if (left.id !== right.id || left.url !== right.url) {
      return false;
    }
  }
  return true;
};

const arePollsEqual = (a, b) => {
  const arrA = Array.isArray(a) ? a : [];
  const arrB = Array.isArray(b) ? b : [];
  if (arrA.length !== arrB.length) return false;
  for (let idx = 0; idx < arrA.length; idx += 1) {
    const leftId = arrA[idx]?.id ?? null;
    const rightId = arrB[idx]?.id ?? null;
    if (leftId !== rightId) return false;
  }
  return true;
};

export const arePostsStructurallyEqual = (prevPost, nextPost) => {
  if (prevPost === nextPost) return true;
  if (!prevPost || !nextPost) return false;

  for (const field of SCALAR_POST_FIELDS) {
    if (normalizeValue(prevPost[field]) !== normalizeValue(nextPost[field])) {
      return false;
    }
  }

  if (!areProfilesEqual(prevPost.profiles, nextPost.profiles)) {
    return false;
  }

  if (!areImagesEqual(prevPost.post_images, nextPost.post_images)) {
    return false;
  }

  if (!arePollsEqual(prevPost.polls_app, nextPost.polls_app)) {
    return false;
  }

  return true;
};

function PostCardComponent({ post: initialPost, user, onDeleted, onUpdated }) {
  const { theme, isDark } = useTheme();
  const { profile: myProfile, isElevated: ctxElevated } = useAuth();
  const navigation = useNavigation();
  const [post, setPost] = useState(initialPost);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [mediaWidth, setMediaWidth] = useState(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const userId = user?.id ?? null;
  const sanitizedTitle = useMemo(
    () => sanitizeTextContent(post?.title),
    [post?.title]
  );
  const sanitizedDescription = useMemo(
    () => sanitizeTextContent(post?.description),
    [post?.description]
  );
  const mediaUrls = useMemo(() => extractMediaUrls(post), [post]);

  const closeImageViewer = useCallback(() => {
    setViewerVisible(false);
    setViewerIndex(null);
  }, []);

  const openImageViewer = useCallback(
    (index = 0) => {
      if (!mediaUrls.length) return;
      const safeIndex = Number.isFinite(index)
        ? Math.min(Math.max(index, 0), mediaUrls.length - 1)
        : 0;
      setViewerIndex(safeIndex);
      setViewerVisible(true);
    },
    [mediaUrls]
  );

  const showNextImage = useCallback(() => {
    setViewerIndex((prev) => {
      if (prev == null) return prev;
      const total = mediaUrls.length;
      if (!total) return null;
      const next = Math.min(prev + 1, total - 1);
      return next === prev ? prev : next;
    });
  }, [mediaUrls]);

  const showPrevImage = useCallback(() => {
    setViewerIndex((prev) => {
      if (prev == null) return prev;
      const total = mediaUrls.length;
      if (!total) return null;
      const next = Math.max(prev - 1, 0);
      return next === prev ? prev : next;
    });
  }, [mediaUrls]);
  const mediaContent = useMemo(() => {
    if (!mediaUrls.length) return null;
    if (mediaUrls.length === 1) {
      return (
        <View
          style={styles.mediaRow}
          onLayout={(event) => {
            const width = event?.nativeEvent?.layout?.width ?? 0;
            if (!width) return;
            setMediaWidth((prev) =>
              prev && Math.abs(prev - width) < 1 ? prev : width
            );
          }}
        >
          <MediaItem
            key={`single-${post.id}`}
            url={mediaUrls[0]}
            mediaWidth={mediaWidth}
            onPress={() => openImageViewer(0)}
          />
        </View>
      );
    }
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.mediaRow}
        onLayout={(event) => {
          const width = event?.nativeEvent?.layout?.width ?? 0;
          if (!width) return;
          setMediaWidth((prev) =>
            prev && Math.abs(prev - width) < 1 ? prev : width
          );
        }}
      >
        {mediaUrls.map((u, idx) => (
          <MediaItem
            key={`${post.id}-${idx}-${u}`}
            url={u}
            mediaWidth={mediaWidth}
            onPress={() => openImageViewer(idx)}
          />
        ))}
      </ScrollView>
    );
  }, [mediaUrls, mediaWidth, openImageViewer, post?.id]);

  const activeImageUrl = useMemo(() => {
    if (viewerIndex == null) return null;
    if (viewerIndex < 0 || viewerIndex >= mediaUrls.length) return null;
    return mediaUrls[viewerIndex];
  }, [mediaUrls, viewerIndex]);

  useEffect(() => {
    if (!viewerVisible) return;
    if (!activeImageUrl) {
      closeImageViewer();
    }
  }, [activeImageUrl, closeImageViewer, viewerVisible]);

  const modalVisible = viewerVisible && !!activeImageUrl;
  const hasMultipleImages = mediaUrls.length > 1;
  const canGoPrev = hasMultipleImages && viewerIndex != null && viewerIndex > 0;
  const canGoNext =
    hasMultipleImages &&
    viewerIndex != null &&
    viewerIndex < mediaUrls.length - 1;
  const viewerCounterLabel =
    hasMultipleImages && viewerIndex != null
      ? `${viewerIndex + 1} / ${mediaUrls.length}`
      : null;

  useEffect(() => {
    const baseStyle = isDark ? "light-content" : "dark-content";
    const baseBackground =
      theme?.background || (isDark ? "#000000" : "#FFFFFF");
    if (modalVisible) {
      StatusBar.setBarStyle("light-content", true);
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#000000");
      }
    } else {
      StatusBar.setBarStyle(baseStyle, true);
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor(baseBackground);
      }
    }
    return () => {
      StatusBar.setBarStyle(baseStyle, true);
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor(baseBackground);
      }
    };
  }, [isDark, modalVisible, theme?.background]);
  const relativeTimestamp = useMemo(() => {
    if (!post?.created_at) return "";
    return dayjs.utc(post.created_at).local().fromNow();
  }, [post?.created_at]);
  const isElevated =
    !!ctxElevated ||
    (myProfile?.role &&
      ["admin", "ceo"].includes(String(myProfile.role).toLowerCase())) ||
    !!(myProfile?.is_admin || myProfile?.is_ceo);
  const isOwner = !!userId && userId === post?.user_id;
  const canDelete = !!userId && (isElevated || isOwner);
  const [adminMenuVisible, setAdminMenuVisible] = useState(false);
  const [reasonVisible, setReasonVisible] = useState(false);
  const [flagVisible, setFlagVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  useEffect(() => {
    setPost((prev) =>
      arePostsStructurallyEqual(prev, initialPost) ? prev : initialPost
    );
  }, [initialPost]);
  const pollRelation = Array.isArray(post?.polls_app) ? post.polls_app : null;
  const pollPreview =
    pollRelation && pollRelation.length > 0 ? pollRelation[0] : null;
  const shouldFetchPollByPost =
    !!post?.id && (!pollRelation || pollRelation.length === 0);
  const {
    poll,
    loading: pollLoading,
    vote: voteOnPoll,
    revokeVote: revokePollVote,
  } = usePoll({
    postId: shouldFetchPollByPost ? post?.id : null,
    pollId: pollPreview?.id || null,
    userId,
  });
  const pollDisabled = !userId;

  const handleSaveEdit = useCallback(
    async ({ title, description, visibility }) => {
      if (!post?.id) throw new Error("Missing post");
      if (!isOwner || !userId)
        throw new Error("Only the owner can edit this post");
      const nextVisibility =
        visibility === "friends" || visibility === "public"
          ? visibility
          : post?.visibility;
      const updates = { title, description, visibility: nextVisibility };
      const { error } = await supabase
        .from("posts")
        .update(updates)
        .eq("id", post.id)
        .eq("user_id", userId);
      if (error) throw error;
      const nextPost = { ...post, ...updates };
      setPost(nextPost);
      try {
        onUpdated?.(nextPost);
      } catch (err) {
        console.error("onUpdated handler failed:", err?.message || err);
      }
      showToast("Post updated");
    },
    [isOwner, onUpdated, post, userId]
  );

  const handlePollVote = useCallback(
    async (optionId) => {
      if (!optionId) return;
      try {
        await voteOnPoll(optionId);
      } catch (err) {
        console.error("poll vote failed:", err?.message || err);
        showToast("Unable to record vote");
      }
    },
    [voteOnPoll]
  );

  const handlePollRevoke = useCallback(async () => {
    try {
      await revokePollVote();
    } catch (err) {
      console.error("poll revoke failed:", err?.message || err);
      showToast("Unable to update vote");
    }
  }, [revokePollVote]);

  // relies on AuthContext profile/isElevated now

  const handleDeletePost = () => {
    if (!canDelete) return;
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const result = await deletePostModeration({
              postId: post.id,
              reason: null,
              reportId: null,
            });
            if (!result?.success) throw new Error(result?.error || "Delete failed");
            try {
              onDeleted?.(post.id);
            } catch {}
            try {
              navigation.canGoBack() && navigation.goBack();
            } catch {}
          } catch (e) {
            console.error("delete post:", e.message);
            showToast("Delete failed");
            return;
          }
          showToast("Post deleted");
        },
      },
    ]);
  };

  const handleAdminDeleteWithReason = async (reason) => {
    try {
      const result = await deletePostModeration({
        postId: post.id,
        reason: reason || null,
        reportId: null,
      });
      if (!result?.success) throw new Error(result?.error || "Delete failed");
      try {
        onDeleted?.(post.id);
      } catch {}
      showToast("Post removed");
      try {
        navigation.canGoBack() && navigation.goBack();
      } catch {}
    } catch (e) {
      console.error("delete post (reason):", e.message);
      showToast("Delete failed");
    }
  };

  const fetchCommentsCount = React.useCallback(async () => {
    try {
      const count = await getCommentCount(post.id);
      setCommentCount(count);
    } catch (err) {
      console.error("Error fetching comment count:", err.message);
    }
  }, [post?.id]);

  useEffect(() => {
    if (!post?.id) return;
    fetchCommentsCount();

    const channel = supabase
      .channel("comments-post-card-" + post.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${post.id}`,
        },
        () => fetchCommentsCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post?.id, fetchCommentsCount]);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      {isElevated && (
        <TouchableOpacity
          onPress={() => setAdminMenuVisible(true)}
          style={styles.gearBtn}
          accessibilityRole="button"
          accessibilityLabel="Open admin actions"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={18} color={theme.muted} />
        </TouchableOpacity>
      )}
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            const uname = post.profiles?.username;
            if (uname) {
              navigation.navigate("Profile", {
                screen: "PublicProfile",
                params: { username: uname },
              });
            } else {
              navigation.navigate("Profile");
            }
          }}
          style={{ flexDirection: "row", alignItems: "center" }}
          activeOpacity={0.7}
        >
          {post.profiles?.profile_image_url ? (
            <Image
              source={{ uri: post.profiles.profile_image_url }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[styles.avatar, { backgroundColor: theme.cardSoft }]}
            />
          )}
          <View>
            <Text style={[styles.username, { color: theme.text }]}>
              {post.profiles?.username || "Unknown"}
            </Text>
            <Text style={[styles.timestamp, { color: theme.muted }]}>
              {relativeTimestamp}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {sanitizedTitle ? (
        <MentionsText
          text={sanitizedTitle}
          style={[styles.title, { color: theme.text }]}
          mentionStyle={{ color: theme.primary }}
        />
      ) : null}

      {sanitizedDescription ? (
        <MentionsText
          text={sanitizedDescription}
          style={[styles.description, { color: theme.text }]}
          mentionStyle={{ color: theme.primary }}
        />
      ) : null}

      {pollLoading && pollPreview && !poll ? (
        <View style={[styles.pollPlaceholder, { borderColor: theme.border }]}>
          <Text style={[styles.pollPlaceholderText, { color: theme.muted }]}>
            Loading poll…
          </Text>
        </View>
      ) : null}

      {poll ? (
        <PollModule
          poll={poll}
          onVote={handlePollVote}
          onRevoke={handlePollRevoke}
          loading={pollLoading}
          disabled={pollDisabled}
        />
      ) : null}

      {mediaContent}

      {/* Footer: Votes + Comments */}
      <View style={styles.footerRow}>
        <VoteButtons postId={post.id} userId={userId} />
        <View style={styles.footerActions}>
          <TouchableOpacity
            onPress={() => setShowComments((v) => !v)}
            style={styles.actionButton}
          >
            <Text style={[styles.commentCount, { color: theme.muted }]}>
              💬 {commentCount}
            </Text>
          </TouchableOpacity>
          {isOwner ? (
            <>
              <TouchableOpacity
                onPress={() => setEditVisible(true)}
                accessibilityLabel="Edit post"
                style={styles.iconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="create-outline" size={18} color={theme.muted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeletePost}
                style={styles.actionButton}
              >
                <Text style={[styles.commentCount, { color: "red" }]}>🗑</Text>
              </TouchableOpacity>
            </>
          ) : (
            !!userId && (
              <TouchableOpacity
                onPress={() => setFlagVisible(true)}
                accessibilityLabel="Report post"
                style={styles.iconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="flag-outline" size={18} color={theme.muted} />
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
      {showComments && (
        <CommentsSection
          postId={post.id}
          onCommentCountChange={setCommentCount}
        />
      )}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={closeImageViewer}
      >
        <View style={styles.viewerBackdrop}>
          {activeImageUrl ? (
            <ZoomableImage
              key={activeImageUrl}
              uri={activeImageUrl}
              onSwipeLeft={canGoNext ? showNextImage : undefined}
              onSwipeRight={canGoPrev ? showPrevImage : undefined}
            />
          ) : null}
          <TouchableOpacity
            style={styles.viewerCloseButton}
            onPress={closeImageViewer}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Close image viewer"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {canGoPrev ? (
            <TouchableOpacity
              style={[styles.viewerNavButton, styles.viewerNavButtonLeft]}
              onPress={showPrevImage}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Show previous image"
            >
              <Ionicons name="chevron-back" size={32} color="#fff" />
            </TouchableOpacity>
          ) : null}
          {canGoNext ? (
            <TouchableOpacity
              style={[styles.viewerNavButton, styles.viewerNavButtonRight]}
              onPress={showNextImage}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Show next image"
            >
              <Ionicons name="chevron-forward" size={32} color="#fff" />
            </TouchableOpacity>
          ) : null}
          {viewerCounterLabel ? (
            <View style={styles.viewerCounter}>
              <Text style={styles.viewerCounterText}>{viewerCounterLabel}</Text>
            </View>
          ) : null}
        </View>
      </Modal>
      <AdminActionMenu
        visible={adminMenuVisible}
        onClose={() => setAdminMenuVisible(false)}
        onDelete={() => {
          setAdminMenuVisible(false);
          handleDeletePost();
        }}
        onAskReason={() => {
          setAdminMenuVisible(false);
          setReasonVisible(true);
        }}
        onOpenDashboard={() => {
          setAdminMenuVisible(false);
          navigation.navigate("Profile", { screen: "AdminDashboard" });
        }}
      />
      <ReasonModal
        visible={reasonVisible}
        title="Reason for removal"
        placeholder="Explain why this post is removed"
        onCancel={() => setReasonVisible(false)}
        onSubmit={(txt) => {
          setReasonVisible(false);
          handleAdminDeleteWithReason(txt);
        }}
      />
      <FlagPostModal
        visible={flagVisible}
        onCancel={() => setFlagVisible(false)}
        onSubmit={async (reason) => {
          setFlagVisible(false);
          try {
            await flagPost({ postId: post.id, userId, reason });
            showToast("Reported");
          } catch (e) {
            console.error("flag post:", e.message);
            showToast("Report failed");
          }
        }}
      />
      <EditPostModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        initialTitle={post?.title || ""}
        initialDescription={post?.description || ""}
        initialVisibility={post?.visibility || "public"}
        onSave={handleSaveEdit}
      />
    </View>
  );
}

const arePostCardPropsEqual = (prevProps, nextProps) => {
  const prevUserId = prevProps.user?.id ?? null;
  const nextUserId = nextProps.user?.id ?? null;
  if (prevUserId !== nextUserId) return false;
  if (prevProps.onDeleted !== nextProps.onDeleted) return false;
  if (prevProps.onUpdated !== nextProps.onUpdated) return false;
  return arePostsStructurallyEqual(prevProps.post, nextProps.post);
};

const PostCard = React.memo(PostCardComponent, arePostCardPropsEqual);

export default PostCard;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 16,
    padding: 12,
    position: "relative",
  },
  gearBtn: {
    position: "absolute",
    right: 8,
    top: 8,
    padding: 4,
    borderRadius: 12,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: "#ccc",
  },
  username: {
    fontFamily: "BlackOpsOne-Regular",
    fontSize: 16,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  title: { fontFamily: "BlackOpsOne-Regular", fontSize: 16, marginBottom: 6 },
  description: { fontSize: 14, lineHeight: 20 },
  pollPlaceholder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pollPlaceholderText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  mediaRow: { marginTop: 8, width: "100%" },
  mediaItemWrapperLoose: {
    marginRight: 8,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaItemWrapperTight: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  videoSurface: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  commentCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  iconButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginLeft: 8,
  },
  debugPill: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "#333c",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  debugText: { color: "#fff", fontSize: 10 },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImageWrapper: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
  },
  viewerCloseButton: {
    position: "absolute",
    top: 36,
    right: 20,
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#000",
  },
  viewerNavButton: {
    position: "absolute",
    top: "50%",
    marginTop: -28,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: "#000",
  },
  viewerNavButtonLeft: {
    left: 20,
  },
  viewerNavButtonRight: {
    right: 20,
  },
  viewerCounter: {
    position: "absolute",
    bottom: 36,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#000",
  },
  viewerCounterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
