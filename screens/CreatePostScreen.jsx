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
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [stage, setStage] = useState("");
  const [visibility, setVisibility] = useState("public");
  const lastProgressValueRef = useRef(0);
  const lastProgressTsRef = useRef(0);
  const imageProgressMaxRef = useRef({});

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
    try {
      setLoading(true);
      setProgress(0);
      lastProgressValueRef.current = 0;
      lastProgressTsRef.current = 0;
      imageProgressMaxRef.current = {};
      setStage("");
      // Quick guard: ensure there is content
      if (!title && !description && images.length === 0 && !videoUri) {
        Alert.alert(
          "Add content",
          "Please add a title, description, image, or video."
        );
        return;
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
          if (i === 0) imageUrl = url; // first image as primary for backward compat
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

      // Insert post_images rows if any, with captions when supported
      if (data?.id && uploadedImageUrls.length > 0) {
        try {
          // Attempt with caption column first
          const withCaptions = uploadedImageUrls.map((u, i) => ({ post_id: data.id, url: u, caption: images[i]?.caption || null }));
          const { error: capErr } = await supabase.from('post_images').insert(withCaptions);
          if (capErr) {
            // Fallback without caption if column doesn't exist
            await supabase.from('post_images').insert(uploadedImageUrls.map((u) => ({ post_id: data.id, url: u })));
          }
        } catch (e) {
          console.warn("post_images insert failed:", e.message);
        }
      }

      if (data?.id) {
        const mentionCandidates = parseMentions(`${title}\n${description}`);
        if (mentionCandidates.length) {
          await notifyMentions({
            mentions: mentionCandidates,
            fromUserId: user.id,
            postId: data.id,
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
      if (data?.id) {
        navigation.navigate("Feed", {
          screen: "SinglePost",
          params: { postId: data.id },
        });
      } else {
        navigation.navigate("Feed");
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
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
        contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
      >
        <MentionInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          currentUsername={authProfile?.username}
          style={{ marginBottom: 12 }}
          inputStyle={[
            styles.input,
            {
              borderColor: theme.border,
              color: theme.text,
              backgroundColor: theme.card,
              marginRight: 0,
            },
          ]}
        />
        <MentionInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          multiline
          currentUsername={authProfile?.username}
          style={{ marginBottom: 12 }}
          inputStyle={[
            styles.input,
            styles.textArea,
            {
              borderColor: theme.border,
              color: theme.text,
              backgroundColor: theme.card,
              marginRight: 0,
            },
          ]}
        />
        <View style={styles.visibilitySection}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>
            Visibility
          </Text>
          <View style={styles.visibilityOptions}>
            {VISIBILITY_OPTIONS.map((option) => {
              const active = visibility === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.visibilityOption,
                    {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active
                        ? theme.primary
                        : "transparent",
                    },
                  ]}
                  onPress={() => setVisibility(option.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.visibilityLabel,
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
          <View style={[styles.gifPreview, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <Image source={{ uri: selectedGif.preview || selectedGif.url }} style={styles.gifImage} resizeMode="cover" />
            <TouchableOpacity style={styles.removeBtn} onPress={() => setSelectedGif(null)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.row}>
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
      </ScrollView>

      <View
        style={[
          styles.fixedBar,
          { backgroundColor: theme.surface, borderTopColor: theme.border },
        ]}
      >
        {loading ? (
          <View style={{ width: "100%" }}>
            {!!stage && (
              <Text
                style={{
                  color: theme.text,
                  marginBottom: 6,
                  textAlign: "center",
                }}
              >
                {stage} {progress > 0 ? `${Math.round(clampProgress(progress))}%` : ""}
              </Text>
            )}
            <View
              style={[styles.progressTrack, { backgroundColor: theme.card }]}
            >
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(100, Math.max(clampProgress(progress), stage ? 10 : 0))}%`,
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            </View>
          </View>
        ) : (
          <ThemedButton
            label={"Create Post"}
            onPress={handlePost}
            theme={theme}
            disabled={loading}
          />
        )}
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
              return [...prev, ...pick.map((u) => ({ uri: u, progress: 0, caption: '' }))];
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
    </View>
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
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  visibilityOptions: {
    flexDirection: "row",
    columnGap: 10,
  },
  visibilityOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  visibilityLabel: {
    fontSize: 14,
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
  fixedBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  progressTrack: { height: 8, borderRadius: 6, overflow: "hidden" },
  progressBar: { height: 8, borderRadius: 6 },
  themedButton: {
    marginTop: 15,
  }
});




