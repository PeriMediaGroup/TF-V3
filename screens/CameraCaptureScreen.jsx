import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ScreenOrientation from "expo-screen-orientation";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { logPermissionEvent } from "../utils/analytics";

const FLASH_SEQUENCE = ["off", "on", "auto"];
const FLASH_ICON = {
  off: "flash-off",
  on: "flash",
  auto: "flash-outline",
};

const { Orientation, OrientationLock } = ScreenOrientation;

export default function CameraCaptureScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const onCapture = route.params?.onCapture;
  const initialFacing = route.params?.initialFacing === "front" ? "front" : "back";

  const cameraRef = useRef(null);
  const orientationRef = useRef(Orientation.PORTRAIT_UP);
  const lastPermissionSnapshotRef = useRef(null);

  const [permission, requestPermissionAsync] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [facing, setFacing] = useState(initialFacing);
  const [flash, setFlash] = useState("off");
  const [orientationMode, setOrientationMode] = useState("portrait");
  const [ratio, setRatio] = useState("4:3");
  const [capturing, setCapturing] = useState(false);

  const { top, bottom } = useSafeAreaInsets();

  const requestCameraPermission = useCallback(
    async (reason) => {
      if (typeof requestPermissionAsync !== "function") return null;
      logPermissionEvent("camera", "request_start", {
        screen: "CameraCapture",
        reason,
      });
      try {
        const result = await requestPermissionAsync();
        logPermissionEvent("camera", "request_result", {
          screen: "CameraCapture",
          reason,
          status: result?.status ?? null,
          granted: Boolean(result?.granted),
          canAskAgain: Boolean(result?.canAskAgain),
        });
        return result;
      } catch (error) {
        logPermissionEvent("camera", "request_error", {
          screen: "CameraCapture",
          reason,
          message: error?.message || String(error),
        });
        throw error;
      }
    },
    [requestPermissionAsync]
  );

  useEffect(() => {
    let cancelled = false;
    if (permission?.status === "undetermined" && !requestingPermission) {
      setRequestingPermission(true);
      requestCameraPermission("initial-check")
        .catch((error) => console.warn("Camera permission request failed", error))
        .finally(() => {
          if (!cancelled) setRequestingPermission(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [permission?.status, requestCameraPermission, requestingPermission]);

  useEffect(() => {
    if (!permission) return;
    const snapshotKey = `${permission.status}-${permission.granted}-${permission.canAskAgain}`;
    if (lastPermissionSnapshotRef.current === snapshotKey) return;
    lastPermissionSnapshotRef.current = snapshotKey;
    logPermissionEvent("camera", "snapshot", {
      screen: "CameraCapture",
      status: permission.status ?? null,
      granted: Boolean(permission.granted),
      canAskAgain: Boolean(permission.canAskAgain),
    });
  }, [permission]);

  useEffect(() => {
    if (facing === "front" && flash !== "off") {
      setFlash("off");
    }
  }, [facing, flash]);

  useEffect(() => {
    setCameraReady(false);
  }, [facing]);

  useEffect(() => {
    setCameraReady(false);
    let active = true;
    const applyLock = async () => {
      try {
        if (orientationMode === "portrait") {
          await ScreenOrientation.lockAsync(OrientationLock.PORTRAIT);
          if (active) setRatio("4:3");
        } else {
          await ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE);
          if (active) setRatio("16:9");
        }
      } catch (error) {
        if (__DEV__) console.warn("[CameraCapture] orientation lock failed", error);
      }
    };
    applyLock();

    return () => {
      active = false;
    };
  }, [orientationMode]);

  useEffect(() => {
    const subscription = ScreenOrientation.addOrientationChangeListener(({ orientationInfo }) => {
      if (
        orientationInfo?.orientation != null &&
        orientationInfo.orientation !== Orientation.UNKNOWN
      ) {
        orientationRef.current = orientationInfo.orientation;
      }
    });

    ScreenOrientation.getOrientationAsync()
      .then((currentOrientation) => {
        if (typeof currentOrientation === "number" && currentOrientation !== Orientation.UNKNOWN) {
          orientationRef.current = currentOrientation;
        }
      })
      .catch(() => {});

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
      ScreenOrientation.lockAsync(OrientationLock.PORTRAIT).catch(() => {});
    };
  }, []);

  const handleToggleFlash = useCallback(() => {
    if (facing === "front") return;
    const index = FLASH_SEQUENCE.indexOf(flash);
    const next = FLASH_SEQUENCE[(index + 1) % FLASH_SEQUENCE.length];
    setFlash(next);
  }, [flash, facing]);

  const handleToggleFacing = useCallback(() => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  }, []);

  const handleToggleOrientation = useCallback(() => {
    setOrientationMode((prev) => (prev === "portrait" ? "landscape" : "portrait"));
  }, []);

  const handleTakePhoto = useCallback(async () => {
    if (!cameraReady || capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: true,
        exif: true,
      });

      if (photo?.uri) {
        try {
          const orientation = orientationRef.current;
          await Promise.resolve(
            onCapture?.(photo.uri, {
              orientation,
              facing,
              width: photo.width,
              height: photo.height,
            })
          );
        } finally {
          navigation.goBack();
        }
      }
    } catch (error) {
      console.warn("Snap error:", error);
      setCapturing(false);
    }
  }, [cameraReady, capturing, onCapture, navigation, facing]);

  if (!permission || requestingPermission) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.statusText}>Checking permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.fullCenter}>
        <Text style={[styles.statusText, styles.statusTextFirst]}>
          Camera permission is required to take photos.
        </Text>
        {permission.canAskAgain ? (
          <TouchableOpacity
            onPress={() => {
              if (!requestingPermission) {
                setRequestingPermission(true);
                requestCameraPermission("cta-button")
                  .catch((error) =>
                    console.warn("Camera permission request failed", error)
                  )
                  .finally(() => setRequestingPermission(false));
              }
            }}
            style={styles.primaryButton}
            disabled={requestingPermission}
          >
            <Text style={styles.primaryButtonLabel}>
              {requestingPermission ? "Requesting..." : "Grant Permission"}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.statusHint}>
            Please enable camera access from system settings.
          </Text>
        )}
      </View>
    );
  }

  const flashIcon = FLASH_ICON[flash] || "flash-off";
  const flashLabel = flash === "auto" ? "Auto" : flash === "on" ? "On" : "Off";

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        ratio={ratio}
        photo
        flash={facing === "front" ? "off" : flash}
        enableHighQualityPhotos
        enableZoomGesture
        onCameraReady={() => setCameraReady(true)}
      />

      {!cameraReady && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.statusText}>Preparing camera...</Text>
        </View>
      )}

      <View style={[styles.topOverlay, { paddingTop: top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.roundButton}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>

        <View style={styles.topControls}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              facing === "front" && styles.optionButtonDisabled,
            ]}
            onPress={handleToggleFlash}
            disabled={facing === "front"}
          >
            <Ionicons
              name={flashIcon}
              size={22}
              color="#fff"
              style={{ marginBottom: 2 }}
            />
            <Text style={styles.optionLabel}>Flash {flashLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton} onPress={handleToggleOrientation}>
            <Ionicons
              name={orientationMode === "portrait" ? "phone-landscape" : "phone-portrait"}
              size={22}
              color="#fff"
              style={{ marginBottom: 2 }}
            />
            <Text style={styles.optionLabel}>
              {orientationMode === "portrait" ? "Landscape" : "Portrait"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton} onPress={handleToggleFacing}>
            <Ionicons name="camera-reverse" size={24} color="#fff" style={{ marginBottom: 2 }} />
            <Text style={styles.optionLabel}>
              {facing === "back" ? "Front" : "Rear"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.bottomOverlay, { paddingBottom: bottom + 28 }]}>
        <View style={styles.shutterOuter}>
          <TouchableOpacity
            style={[
              styles.shutterButton,
              capturing && styles.shutterButtonDisabled,
            ]}
            onPress={handleTakePhoto}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1, width: "100%", height: "100%" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullCenter: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  statusText: {
    color: "#fff",
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 16,
  },
  statusTextFirst: {
    marginTop: 0,
  },
  statusHint: {
    color: "#fff",
    opacity: 0.8,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 24,
    fontSize: 13,
  },
  primaryButton: {
    marginTop: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#1e88e5",
  },
  primaryButtonLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  topControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionButton: {
    minWidth: 70,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionButtonDisabled: {
    opacity: 0.45,
  },
  optionLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 16,
  },
  shutterOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterButtonDisabled: {
    opacity: 0.6,
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#e53935",
  },
});
