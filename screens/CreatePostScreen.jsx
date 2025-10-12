// screens/CreatePostScreen.jsx
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  UIManager,
  findNodeHandle,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import supabase from "../supabase/client";
import {
  uploadImage,
  uploadVideo,
  uploadImageWithProgress,
  uploadVideoWithProgress,
} from "../utils/cloudinary";
import { useRoute, useNavigation } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../styles/ThemeContext";
import MediaPickerSheet from "../components/media/MediaPickerSheet";
import GiphyPickerSheet from "../components/media/GiphyPickerSheet";
import MentionInput from "../components/common/MentionInput";
import { parseMentions } from "../utils/parseMentions";
import { useMentionNotifier } from "../hooks/useMentionNotifier";
import { createPollForPost } from "../supabase/polls";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmojiPickerModal from "../components/common/EmojiPickerModal";

const { Orientation } = ScreenOrientation;
const VISIBILITY_OPTIONS = [
  { key: "public", label: "Public" },
  { key: "friends", label: "Friends Only" },
];

const clampProgress = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
};
const applyOrientationTransform = (url, orientation) => {
  if (!url || orientation === null || Number.isNaN(orientation)) return url;
  const angle = (() => {
    if (orientation === Orientation.LANDSCAPE_LEFT) return '-90';
    if (orientation === Orientation.LANDSCAPE_RIGHT) return '90';
    if (orientation === Orientation.PORTRAIT_DOWN) return '180';
    return null;
  })();
  if (!angle) return url;
  const token = '/upload/';
  const idx = url.indexOf(token);
  if (idx === -1) return url;
  const prefix = url.slice(0, idx + token.length);
  const rest = url.slice(idx + token.length);
  if (rest.startsWith(`a_${angle}/`)) return url;
  return `${prefix}a_${angle}/${rest}`;
};
const rotationForOrientation = (orientation) => {
  switch (orientation) {
    case Orientation.LANDSCAPE_LEFT:
      return "90deg";
    case Orientation.LANDSCAPE_RIGHT:
      return "-90deg";
    case Orientation.PORTRAIT_DOWN:
      return "180deg";
    default:
      return "0deg";
  }
};

const aspectForOrientation = (orientation) => {
  if (orientation === Orientation.PORTRAIT_UP || orientation === Orientation.PORTRAIT_DOWN) {
    return 9 / 16;
  }
  if (orientation === Orientation.LANDSCAPE_LEFT || orientation === Orientation.LANDSCAPE_RIGHT) {
    return 16 / 9;
  }
  return 16 / 9;
};

function VideoPreview({ uri, theme, orientation }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = false;
  });

  const aspectRatio = aspectForOrientation(orientation);
  const rotation = rotationForOrientation(orientation);
  const videoStyle = [styles.videoPlayer];
  if (rotation !== "0deg") {
    videoStyle.push({ transform: [{ rotate: rotation }] });
  }

  return (
    <View style={[styles.videoWrap, { borderColor: theme.border }]}>
      <View style={[styles.videoSurface, { aspectRatio }]}>

        <VideoView
          player={player}
          style={videoStyle}
          nativeControls
          contentFit="contain"
        />
      </View>
    </View>
  );
}

export default function CreatePostScreen({ navigation }) {
  const { user, profile: authProfile } = useAuth();
  const { theme } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]); // [{ uri, progress }]
  const [videoUri, setVideoUri] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoOrientation, setVideoOrientation] = useState(null);
  const [selectedGif, setSelectedGif] = useState(null);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [stage, setStage] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [emojiTarget, setEmojiTarget] = useState(null);
  const lastProgressValueRef = useRef(0);
  const lastProgressTsRef = useRef(0);
  const imageProgressMaxRef = useRef({});
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardInset = Math.max(0, keyboardHeight - insets.bottom);
  const keyboardOffset = Platform.OS === "ios" ? insets.top + 16 : 0;
  const scrollRef = useRef(null);
  const fieldRefs = useRef({});
  const pendingScrollKeyRef = useRef(null);
  const registerInputRef = useCallback((key) => (node) => {
    if (node) {
      fieldRefs.current[key] = node;
    } else {
      delete fieldRefs.current[key];
    }
  }, []);
  const measureAndScrollTo = useCallback(
    (key) => {
      const targetRef = fieldRefs.current[key];
      if (!targetRef || !scrollRef.current) return;
      const targetNode = targetRef.getNode?.() ?? targetRef;
      const targetHandle = findNodeHandle(targetNode);
      const scrollView = scrollRef.current;
      const scrollInner = scrollView?.getInnerViewNode?.();
      const scrollHandle = scrollInner ? findNodeHandle(scrollInner) : findNodeHandle(scrollView);
      if (!targetHandle || !scrollHandle) return;
      UIManager.measureLayout(
        targetHandle,
        scrollHandle,
        () => {},
        (x, y, width, height) => {
          const buffer = keyboardHeight > 0 ? keyboardHeight + 32 : height + 160;
          const offset = Math.max(0, y - buffer);
          scrollRef.current?.scrollTo({ y: offset, animated: true });
          pendingScrollKeyRef.current = null;
        }
      );
    },
    [keyboardHeight]
  );
  const scrollToInput = useCallback(
    (key) => {
      pendingScrollKeyRef.current = key;
      requestAnimationFrame(() => measureAndScrollTo(key));
    },
    [measureAndScrollTo]
  );

  const openEmojiPicker = useCallback((target) => {
    setEmojiTarget(target);
    setEmojiPickerVisible(true);
  }, []);

  const closeEmojiPicker = useCallback(() => {
    setEmojiPickerVisible(false);
    setEmojiTarget(null);
  }, []);

  const handleEmojiSelect = useCallback(
    (emoji) => {
      const char = emoji?.native;
      if (!char || !emojiTarget) return;

      const { type, index } = emojiTarget;

      switch (type) {
        case "title":
          setTitle((prev) => (prev || "") + char);
          break;
        case "description":
          setDescription((prev) => (prev || "") + char);
          break;
        case "poll-question":
          setPollQuestion((prev) => (prev || "") + char);
          break;
        case "poll-option":
          setPollOptions((prev) => {
            const next = [...prev];
            if (typeof index === "number" && next[index] != null) {
              next[index] = (next[index] || "") + char;
            }
            return next;
          });
          break;
        default:
          break;
      }

      requestAnimationFrame(() => {
        const refKey =
          type === "poll-option" && typeof index === "number"
            ? `poll-option-${index}`
            : type;
        const ref = refKey ? fieldRefs.current[refKey] : null;
        ref?.focus?.();
      });

      closeEmojiPicker();
    },
    [emojiTarget, closeEmojiPicker]
  );

  const resetPollState = useCallback(() => {
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollEnabled(false);
  }, []);

  const handlePollOptionChange = useCallback((value, index) => {
    setPollOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const addPollOption = useCallback(() => {
    setPollOptions((prev) => {
      if (prev.length >= 6) return prev;
      const next = [...prev, ""];
      requestAnimationFrame(() => scrollToInput(`poll-option-${next.length - 1}`));
      return next;
    });
  }, [scrollToInput]);

  const removePollOption = useCallback((index) => {
    setPollOptions((prev) => {
      if (prev.length <= 2) return prev;
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : ["", ""];
    });
  }, []);

  const updateOverallProgress = useCallback((pct) => {
    const clamped = clampProgress(pct);
    const previous = lastProgressValueRef.current;
    const delta = Math.abs(clamped - previous);
    if (delta < 0.5 && clamped < 100) return;
    const now = Date.now();
    if (now - lastProgressTsRef.current < 80 && clamped < 100) return;
    lastProgressValueRef.current = clamped;
    lastProgressTsRef.current = now;
    setProgress(clamped);
  }, [setProgress]);

  const route = useRoute();
  const nav = useNavigation();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState('photo');
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [giphyVisible, setGiphyVisible] = useState(false);
  const MAX_IMAGES = parseInt(process.env.EXPO_PUBLIC_MAX_IMAGES || "5", 10);
  const notifyMentions = useMentionNotifier();
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const handleShow = (event) => {
      const height = event?.endCoordinates?.height ?? 0;
      setKeyboardHeight(height);
      if (pendingScrollKeyRef.current) {
        requestAnimationFrame(() => measureAndScrollTo(pendingScrollKeyRef.current));
      }
    };
    const handleHide = () => {
      setKeyboardHeight(0);
      pendingScrollKeyRef.current = null;
    };
    const showSub = Keyboard.addListener(showEvent, handleShow);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [measureAndScrollTo]);

  useEffect(() => {
    // Ask permissions up front so pickers and camera work
    (async () => {
      try {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        await ImagePicker.requestCameraPermissionsAsync();
      } catch {}
    })();
    if (route?.params?.recordedVideoUri) {
      setVideoUri(route.params.recordedVideoUri);
      setVideoDuration(route.params.recordedDuration || 0);
      setVideoOrientation(
        typeof route.params.recordedOrientation === "number"
          ? route.params.recordedOrientation
          : null
      );
      // clear param so it doesn't persist
      nav.setParams({
        recordedVideoUri: undefined,
        recordedDuration: undefined,
        recordedOrientation: undefined,
      });
      // if video chosen, clear images
      setImages([]);
      setSelectedGif(null);
    }
  }, [route?.params?.recordedVideoUri, route?.params?.recordedOrientation]);

  const buildPickerOptions = (kind /* 'image' | 'video' */) => ({
    allowsEditing: false,
    quality: 0.8,
    mediaTypes: kind === "image" ? ["images"] : ["videos"],
    ...(kind === "video" ? { videoMaxDuration: 90 } : {}),
  });

  const pickImage = async () => {
    if (videoUri) {
      Alert.alert("Note", "Remove the selected video before picking images.");
      return;
    }
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (lib.status !== "granted") {
      Alert.alert("Permission needed", "Media library permission is required.");
      return;
    }
    try {
      let result = await ImagePicker.launchImageLibraryAsync(
        buildPickerOptions("image")
      );
      // Fallback to legacy if result is unexpected
      if (!result || result.canceled === undefined) {
        result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          quality: 0.8,
          mediaTypes: ["images"],
        });
      }
      if (!result.canceled) {
        const uri = result.assets[0].uri;
        setImages((prev) => [...prev, { uri, progress: 0 }]);
        setVideoUri(null);
        setVideoOrientation(null);
      }
    } catch (e) {
      Alert.alert("Picker error", e?.message || "Unable to open image picker");
    }
  };

  const pickVideo = async () => {
    if (images.length) {
      Alert.alert("Note", "Remove the selected image before picking a video.");
      return;
    }
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (lib.status !== "granted") {
      Alert.alert("Permission needed", "Media library permission is required.");
      return;
    }
    try {
      let result = await ImagePicker.launchImageLibraryAsync(
        buildPickerOptions("video")
      );
      if (!result || result.canceled === undefined) {
        result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          quality: 0.8,
          videoMaxDuration: 90,
          mediaTypes: ["videos"],
        });
      }
      if (!result.canceled) {
        const asset = result.assets[0];
        setVideoUri(asset.uri);
        setVideoOrientation(null);
        setVideoDuration(Math.round((asset.duration || 0) / 1000));
        setImages([]);
      }
    } catch (e) {
      Alert.alert("Picker error", e?.message || "Unable to open video picker");
    }
  };

  const handlePost = async () => {
    let createdPostId = null;
    let pollCreated = false;
    const wantsPoll = pollEnabled;
    try {
      setLoading(true);
      setProgress(0);
      lastProgressValueRef.current = 0;
      lastProgressTsRef.current = 0;
      imageProgressMaxRef.current = {};
      setStage("");
      if (!title && !description && images.length === 0 && !videoUri) {
        Alert.alert(
          "Add content",
          "Please add a title, description, image, or video."
        );
        return;
      }

      const trimmedPollQuestion = (pollQuestion || "").trim();
      const normalizedPollOptions = pollOptions
        .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
        .filter(Boolean);

      if (wantsPoll) {
        if (!trimmedPollQuestion) {
          Alert.alert("Poll question required", "Please add a poll question or disable the poll.");
          return;
        }
        if (normalizedPollOptions.length < 2) {
          Alert.alert("More options needed", "Polls need at least two answer choices.");
          return;
        }
        const uniqueCount = new Set(normalizedPollOptions.map((opt) => opt.toLowerCase())).size;
        if (uniqueCount !== normalizedPollOptions.length) {
          Alert.alert("Duplicate options", "Each poll option must be unique.");
          return;
        }
      }

      let imageUrl = null;
      let videoUrl = null;

      const uploadedImageUrls = [];
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          setStage(`Uploading image ${i + 1} of ${images.length}`);
          const url = await uploadImageWithProgress(images[i].uri, (pct) => {
            const clamped = clampProgress(pct);
            const previous = imageProgressMaxRef.current[i] ?? 0;
            if (clamped <= previous && clamped < 100) return;
            imageProgressMaxRef.current[i] = Math.max(previous, clamped);
            updateOverallProgress(clamped);
            setImages((prev) => {
              const copy = [...prev];
              copy[i] = { ...copy[i], progress: clamped };
              return copy;
            });
          });
          uploadedImageUrls.push(url);
          if (i === 0) imageUrl = url;
        }
      }

      if (images.length > 0 && !videoUri) {
        updateOverallProgress(100);
      }

      if (videoUri) {
        if (videoDuration > 90) {
          Alert.alert("Too long", "Please keep videos 90 seconds or less.");
          return;
        }
        setStage("Uploading video");
        const uploadedVideo = await uploadVideoWithProgress(videoUri, (pct) =>
          updateOverallProgress(pct)
        );
        videoUrl = applyOrientationTransform(uploadedVideo, videoOrientation);
        updateOverallProgress(100);
      }

      setStage("Saving post");
      const { data, error } = await supabase
        .from("posts")
        .insert([
          {
            user_id: user.id,
            title,
            description,
            image_url: imageUrl,
            video_url: videoUrl,
            gif_url: selectedGif?.url || null,
            visibility,
          },
        ])
        .select("id")
        .single();

      if (error) throw error;

      createdPostId = data?.id ?? null;

      if (createdPostId && uploadedImageUrls.length > 0) {
        try {
          const withCaptions = uploadedImageUrls.map((u, i) => ({ post_id: createdPostId, url: u, caption: images[i]?.caption || null }));
          const { error: capErr } = await supabase.from('post_images').insert(withCaptions);
          if (capErr) {
            await supabase.from('post_images').insert(uploadedImageUrls.map((u) => ({ post_id: createdPostId, url: u })));
          }
        } catch (e) {
          console.warn("post_images insert failed:", e.message);
        }
      }

      if (createdPostId && wantsPoll) {
        setStage("Creating poll");
        await createPollForPost({
          postId: createdPostId,
          question: trimmedPollQuestion,
          options: normalizedPollOptions,
          allowMulti: false,
          userId: user.id,
        });
        pollCreated = true;
      }

      if (createdPostId) {
        const mentionCandidates = parseMentions(`${title}
${description}`);
        if (mentionCandidates.length) {
          await notifyMentions({
            mentions: mentionCandidates,
            fromUserId: user.id,
            postId: createdPostId,
          });
        }
      }

      Alert.alert("Success", "Post created!");
      setTitle("");
      setDescription("");
      setImages([]);
      setVideoUri(null);
      setVideoOrientation(null);
      setSelectedGif(null);
      setProgress(0);
      setStage("");
      setVisibility("public");
      resetPollState();
      if (createdPostId) {
        navigation.navigate("Feed", {
          screen: "SinglePost",
          params: { postId: createdPostId },
        });
      } else {
        navigation.navigate("Feed");
      }
    } catch (err) {
      if (createdPostId && wantsPoll && !pollCreated) {
        try {
          await supabase.from("posts").delete().eq("id", createdPostId);
        } catch (cleanupError) {
          console.warn("Failed to rollback post after poll error:", cleanupError?.message || cleanupError);
        }
      }
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardOffset}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIcon}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Create Post
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: 120 + keyboardInset }]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "none"}
          contentInsetAdjustmentBehavior="always"
        >
          <View style={styles.emojiInputRow}>
            <MentionInput
              ref={registerInputRef("title")}
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              currentUsername={authProfile?.username}
              style={{ flex: 1 }}
              inputStyle={[
                styles.input,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  backgroundColor: theme.card,
                  marginRight: 0,
                  marginBottom: 0,
                },
              ]}
              onFocus={() => scrollToInput("title")}
            />
            <TouchableOpacity
              onPress={() => openEmojiPicker({ type: "title" })}
              style={[
                styles.emojiTrigger,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <Text style={[styles.emojiTriggerText, { color: theme.text }]}>
                😀
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.emojiInputRow}>
            <MentionInput
              ref={registerInputRef("description")}
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              multiline
              currentUsername={authProfile?.username}
              style={{ flex: 1 }}
              inputStyle={[
                styles.input,
                styles.textArea,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  backgroundColor: theme.card,
                  marginRight: 0,
                  marginBottom: 0,
                },
              ]}
              onFocus={() => scrollToInput("description")}
            />
            <TouchableOpacity
              onPress={() => openEmojiPicker({ type: "description" })}
              style={[
                styles.emojiTrigger,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
            >
              <Text style={[styles.emojiTriggerText, { color: theme.text }]}>
                😀
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.visibilitySection}>
            <Text style={[styles.visibilityLabel, { color: theme.muted }]}>Visibility:</Text>
            <View style={styles.visibilityOptions}>
              {VISIBILITY_OPTIONS.map((option) => {
                const active = visibility === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.visibilityOption,
                      active
                        ? { backgroundColor: theme.primary, borderColor: theme.primary }
                        : { borderColor: theme.border },
                    ]}
                    onPress={() => setVisibility(option.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.visibilityOptionText,
                        { color: active ? theme.background : theme.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {images.length > 0 && (
            <View style={styles.gallery}>
              {images.map((img, idx) => (
                <View
                  key={`${img.uri}-${idx}`}
                  style={[styles.thumbWrap, { borderColor: theme.border }]}
                >
                  <Image source={{ uri: img.uri }} style={styles.thumb} />
                  {img.progress > 0 && img.progress < 100 && (
                    <View style={styles.thumbProgressTrack}>
                      <View
                        style={[
                          styles.thumbProgressBar,
                          {
                            width: `${img.progress}%`,
                            backgroundColor: theme.primary,
                          },
                        ]}
                      />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() =>
                      setImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {videoUri && <VideoPreview uri={videoUri} theme={theme} orientation={videoOrientation} />}
          {selectedGif && (
            <View
              style={[styles.gifPreview, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <Image
                source={{ uri: selectedGif.preview || selectedGif.url }}
                style={styles.gifImage}
                resizeMode="cover"
              />
              <TouchableOpacity style={styles.removeBtn} onPress={() => setSelectedGif(null)}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.row, styles.mediaButtonRow]}>
            <ThemedButton
              style={[styles.themedButton, { flex: 1 }]}
              label="Photos"
              onPress={() => {
                if (videoUri) { Alert.alert('Note', 'Remove the selected video first.'); return; }
                if (selectedGif) { Alert.alert('Note', 'Remove the selected GIF first.'); return; }
                if (images.length >= MAX_IMAGES) { Alert.alert('Limit reached', `You can add up to ${MAX_IMAGES} images.`); return; }
                setSheetMode('photo');
                setSheetVisible(true);
              }}
              theme={theme}
              disabled={loading}
            />
            <ThemedButton
              style={[styles.themedButton, { flex: 1 }]}
              label="Videos"
              onPress={() => {
                if (images.length > 0) { Alert.alert('Note', 'Remove selected images before picking a video.'); return; }
                if (selectedGif) { Alert.alert('Note', 'Remove the selected GIF first.'); return; }
                setSheetMode('video');
                setSheetVisible(true);
              }}
              theme={theme}
              disabled={loading}
            />
            <ThemedButton
              style={[styles.themedButton, { flex: 1 }]}
              label="GIF"
              onPress={() => {
                if (images.length > 0) { Alert.alert('Note', 'Remove selected images before adding a GIF.'); return; }
                if (videoUri) { Alert.alert('Note', 'Remove the selected video first.'); return; }
                setGiphyVisible(true);
              }}
              theme={theme}
              disabled={loading}
            />
          </View>
          {images.length > 0 && (
            <Text style={{ color: theme.muted, marginTop: 6 }}>{images.length}/{MAX_IMAGES} images selected</Text>
          )}
          {selectedGif && (
            <Text style={{ color: theme.muted, marginTop: 6 }}>1 GIF selected</Text>
          )}

          <View style={[styles.pollSection, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <View style={styles.pollHeader}>
              <Text style={[styles.sectionLabel, { color: theme.text, marginBottom: 0 }]}>
                Poll
              </Text>
              {pollEnabled ? (
                <TouchableOpacity onPress={resetPollState} style={styles.pollAction}>
                  <Text style={[styles.pollActionText, { color: theme.primary }]}>Remove</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setPollEnabled(true);
                    setPollOptions((prev) => (prev.length ? prev : ["", ""]));
                    requestAnimationFrame(() => scrollToInput('poll-question'));
                  }}
                  style={styles.pollAction}
                >
                  <Text style={[styles.pollActionText, { color: theme.primary }]}>Add poll</Text>
                </TouchableOpacity>
              )}
            </View>

            {pollEnabled ? (
              <View style={styles.pollBody}>
                <View style={styles.pollQuestionRow}>
                  <TextInput
                    ref={registerInputRef("poll-question")}
                    value={pollQuestion}
                    onChangeText={setPollQuestion}
                    placeholder="Ask a question"
                    placeholderTextColor={theme.muted}
                    style={[
                      styles.pollInput,
                      {
                        borderColor: theme.border,
                        color: theme.text,
                        backgroundColor: theme.background,
                        flex: 1,
                      },
                    ]}
                    onFocus={() => scrollToInput("poll-question")}
                  />
                  <TouchableOpacity
                    onPress={() => openEmojiPicker({ type: "poll-question" })}
                    style={[
                      styles.emojiTrigger,
                      { borderColor: theme.border, backgroundColor: theme.background },
                    ]}
                  >
                    <Text
                      style={[styles.emojiTriggerText, { color: theme.text }]}
                    >
                      😀
                    </Text>
                  </TouchableOpacity>
                </View>
                {pollOptions.map((option, idx) => (
                  <View key={`poll-opt-${idx}`} style={styles.pollOptionRow}>
                    <TextInput
                      ref={registerInputRef(`poll-option-${idx}`)}
                      value={option}
                      onChangeText={(text) => handlePollOptionChange(text, idx)}
                      placeholder={`Option ${idx + 1}`}
                      placeholderTextColor={theme.muted}
                      style={[
                        styles.pollOptionInput,
                        {
                          borderColor: theme.border,
                          color: theme.text,
                          backgroundColor: theme.background,
                        },
                      ]}
                      onFocus={() => scrollToInput(`poll-option-${idx}`)}
                    />
                    <View style={styles.pollOptionActions}>
                      <TouchableOpacity
                        onPress={() =>
                          openEmojiPicker({ type: "poll-option", index: idx })
                        }
                        style={[
                          styles.emojiTriggerSmall,
                          {
                            borderColor: theme.border,
                            backgroundColor: theme.background,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.emojiTriggerText,
                            { color: theme.text, fontSize: 18 },
                          ]}
                        >
                          😀
                        </Text>
                      </TouchableOpacity>
                      {pollOptions.length > 2 ? (
                        <TouchableOpacity
                          onPress={() => removePollOption(idx)}
                          style={[
                            styles.pollRemoveBtn,
                            { borderColor: theme.border },
                          ]}
                        >
                          <Text
                            style={[styles.pollRemoveText, { color: theme.muted }]}
                          >
                            Remove
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={addPollOption}
                  disabled={pollOptions.length >= 6}
                  style={[
                    styles.pollAddBtn,
                    { borderColor: theme.border, opacity: pollOptions.length >= 6 ? 0.5 : 1 },
                  ]}
                >
                  <Text style={[styles.pollAddText, { color: theme.primary }]}>+ Add option</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.metaHint, { color: theme.muted }]}>
                Add a quick poll to your post. Voters will see live results.
              </Text>
            )}
          </View>

          <View style={styles.actionSection}>
            {loading ? (
              <View style={styles.progressWrapper}>
                {!!stage && (
                  <Text style={[styles.progressText, { color: theme.text }]}>
                    {stage} {progress > 0 ? `${Math.round(clampProgress(progress))}%` : ""}
                  </Text>
                )}
                <View style={[styles.progressTrack, { backgroundColor: theme.card }]}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${Math.min(
                          100,
                          Math.max(clampProgress(progress), stage ? 10 : 0)
                        )}%`,
                        backgroundColor: theme.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : (
              <ThemedButton
                label="Create Post"
                onPress={handlePost}
                theme={theme}
                disabled={loading}
                style={styles.createButton}
              />
            )}
          </View>
        </ScrollView>
      </View>

      <MediaPickerSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        mode={sheetMode}
        theme={theme}
        maxCount={Math.max(0, MAX_IMAGES - images.length)}
        onAdd={(uris) => {
          if (sheetMode === 'photo') {
            setImages((prev) => {
              const room = Math.max(0, MAX_IMAGES - prev.length);
              const pick = uris.slice(0, room);
              return [
                ...prev,
                ...pick.map((u) => ({ uri: u, progress: 0, caption: '' })),
              ];
            });
            setVideoUri(null);
            setSelectedGif(null);
          } else if (sheetMode === 'video') {
            const u = uris[0];
            if (u) {
              setVideoUri(u);
              setVideoOrientation(null);
              setImages([]);
              setSelectedGif(null);
              requestAnimationFrame(() => scrollToInput('description'));
            }
          }
        }}
        onRecordVideo={() => navigation.navigate('VideoRecorder')}
      />
      <GiphyPickerSheet
        visible={giphyVisible}
        onClose={() => setGiphyVisible(false)}
        onSelect={(gif) => {
          setSelectedGif(gif);
          setImages([]);
          setVideoUri(null);
          setVideoOrientation(null);
        }}
        theme={theme}
      />
      <EmojiPickerModal visible={emojiPickerVisible} onClose={closeEmojiPicker} onSelect={handleEmojiSelect} />
    </KeyboardAvoidingView>
  );
}

// Render media picker sheet just below component export
// Note: JSX returned above ends the main layout; we append the sheet inside the same file scope by moving it above return if needed.

function ThemedButton({ label, onPress, theme, disabled, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          backgroundColor: disabled ? theme.cardSoft : theme.primary,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIcon: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSpacer: { width: 24 },
  content: { padding: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  textArea: { height: 100, textAlignVertical: "top" },
  visibilitySection: {
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  visibilityOptions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    columnGap: 8,
    rowGap: 6,
  },
  visibilityOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  visibilityLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  visibilityOptionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  preview: {
    width: "100%",
    height: 200,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  gallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  gifPreview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  gifImage: {
    width: 200,
    height: 200,
  },
  thumbWrap: {
    width: "31%",
    aspectRatio: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  thumb: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  removeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  thumbProgressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 5,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  thumbProgressBar: { height: 5 },
  videoWrap: {
    width: "100%",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  videoSurface: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  videoPlayer: {
    width: "100%",
    height: "100%",
  },
  row: { flexDirection: "row", gap: 12 },
  emojiInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  emojiTrigger: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emojiTriggerSmall: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emojiTriggerText: {
    fontSize: 20,
  },
  progressTrack: { height: 8, borderRadius: 6, overflow: "hidden" },
  progressBar: { height: 8, borderRadius: 6 },
  themedButton: {
    marginTop: 15,
  },
  actionSection: {
    marginTop: 24,
    marginBottom: 32,
  },
  progressWrapper: {
    width: "100%",
  },
  progressText: {
    textAlign: "center",
    marginBottom: 6,
    fontWeight: "600",
  },
  createButton: {
    marginTop: 16,
    width: "100%",
  },
  mediaButtonRow: {
    marginTop: 16,
    marginBottom: 12,
  },
  pollSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
  },
  pollHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pollAction: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pollActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pollBody: {
    gap: 10,
  },
  pollQuestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pollInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
  },
  pollOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pollOptionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  pollOptionInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
  },
  pollRemoveBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pollRemoveText: {
    fontSize: 12,
    fontWeight: "600",
  },
  pollAddBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  pollAddText: {
    fontSize: 14,
    fontWeight: "600",
  },
  metaHint: {
    fontSize: 12,
    fontStyle: "italic",
  },
});
