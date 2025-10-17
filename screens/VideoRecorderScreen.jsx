import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { PinchGestureHandler, State } from "react-native-gesture-handler";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import * as ScreenOrientation from "expo-screen-orientation";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { logPermissionEvent } from "../utils/analytics";

const MAX_SECONDS = 90;
const { Orientation, OrientationLock } = ScreenOrientation;

export default function VideoRecorderScreen() {
  const navigation = useNavigation();
  const cameraRef = useRef(null);
  const orientationRef = useRef(Orientation.PORTRAIT_UP);
  const lastCameraPermissionSnapshotRef = useRef(null);
  const lastMicroPermissionSnapshotRef = useRef(null);
  const [cameraPermission, requestCameraPermissionAsync] = useCameraPermissions();
  const micPermissionsHook =
    typeof useMicrophonePermissions === "function"
      ? useMicrophonePermissions()
      : [{ granted: true }, async () => true];
  const [microphonePermission, requestMicrophonePermissionAsync] = micPermissionsHook;
  const [recording, setRecording] = useState(false);
  const [facing, setFacing] = useState("back"); // 'back' | 'front'
  const [seconds, setSeconds] = useState(0);
  const [zoom, setZoom] = useState(0); // 0..1
  const [baseZoom, setBaseZoom] = useState(0);
  const [torch, setTorch] = useState(false);
  const [mute, setMute] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  const timerRef = useRef(null);

  const requestCameraWithLogging = useCallback(
    async (reason) => {
      if (typeof requestCameraPermissionAsync !== "function") return null;
      logPermissionEvent("camera", "request_start", {
        screen: "VideoRecorder",
        reason,
      });
      try {
        const result = await requestCameraPermissionAsync();
        logPermissionEvent("camera", "request_result", {
          screen: "VideoRecorder",
          reason,
          status: result?.status ?? null,
          granted: Boolean(result?.granted),
          canAskAgain: Boolean(result?.canAskAgain),
        });
        return result;
      } catch (error) {
        logPermissionEvent("camera", "request_error", {
          screen: "VideoRecorder",
          reason,
          message: error?.message || String(error),
        });
        throw error;
      }
    },
    [requestCameraPermissionAsync]
  );

  const requestMicrophoneWithLogging = useCallback(
    async (reason) => {
      if (typeof requestMicrophonePermissionAsync !== "function") return null;
      logPermissionEvent("microphone", "request_start", {
        screen: "VideoRecorder",
        reason,
      });
      try {
        const result = await requestMicrophonePermissionAsync();
        logPermissionEvent("microphone", "request_result", {
          screen: "VideoRecorder",
          reason,
          status: result?.status ?? null,
          granted: Boolean(result?.granted),
          canAskAgain: Boolean(result?.canAskAgain),
        });
        return result;
      } catch (error) {
        logPermissionEvent("microphone", "request_error", {
          screen: "VideoRecorder",
          reason,
          message: error?.message || String(error),
        });
        throw error;
      }
    },
    [requestMicrophonePermissionAsync]
  );

  const allowRotation = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(OrientationLock.DEFAULT);
    } catch (e) {
      if (__DEV__) console.warn("[VideoRecorder] allowRotation failed", e?.message || e);
    }
  }, []);

  const lockForRecording = useCallback(
    async (orientationOverride = null) => {
      try {
        const current =
          typeof orientationOverride === "number" && orientationOverride !== Orientation.UNKNOWN
            ? orientationOverride
            : orientationRef.current;

        orientationRef.current = current;

        if (current === Orientation.LANDSCAPE_LEFT) {
          await ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE_LEFT);
        } else if (current === Orientation.LANDSCAPE_RIGHT) {
          await ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE_RIGHT);
        } else {
          await ScreenOrientation.lockAsync(OrientationLock.PORTRAIT);
        }
      } catch (e) {
        if (__DEV__) console.warn("[VideoRecorder] lockForRecording failed", e?.message || e);
      }
    },
    []
  );

  const handleRequestPermissions = useCallback(
    async (reason = "auto") => {
      const pending = [];
      if (cameraPermission?.granted !== true) {
        pending.push(requestCameraWithLogging(reason));
      }
      if (microphonePermission?.granted !== true && requestMicrophonePermissionAsync) {
        pending.push(requestMicrophoneWithLogging(reason));
      }
      if (!pending.length) return;

      setRequestingPermissions(true);
      try {
        const results = await Promise.allSettled(pending);
        results.forEach((result) => {
          if (result.status === "rejected") {
            console.warn("[VideoRecorder] permission request failed", result.reason);
          }
        });
      } finally {
        setRequestingPermissions(false);
      }
    },
    [
      cameraPermission?.granted,
      microphonePermission?.granted,
      requestCameraWithLogging,
      requestMicrophonePermissionAsync,
      requestMicrophoneWithLogging,
    ]
  );

  useEffect(() => {
    if (
      !requestingPermissions &&
      (cameraPermission?.status === "undetermined" ||
        microphonePermission?.status === "undetermined")
    ) {
      handleRequestPermissions("auto-init");
    }
  }, [
    cameraPermission?.status,
    microphonePermission?.status,
    requestingPermissions,
    handleRequestPermissions,
  ]);

  useEffect(() => {
    if (!cameraPermission) return;
    const snapshotKey = `${cameraPermission.status}-${cameraPermission.granted}-${cameraPermission.canAskAgain}`;
    if (lastCameraPermissionSnapshotRef.current === snapshotKey) return;
    lastCameraPermissionSnapshotRef.current = snapshotKey;
    logPermissionEvent("camera", "snapshot", {
      screen: "VideoRecorder",
      status: cameraPermission.status ?? null,
      granted: Boolean(cameraPermission.granted),
      canAskAgain: Boolean(cameraPermission.canAskAgain),
    });
  }, [cameraPermission]);

  useEffect(() => {
    if (!microphonePermission) return;
    const snapshotKey = `${microphonePermission.status}-${microphonePermission.granted}-${microphonePermission.canAskAgain}`;
    if (lastMicroPermissionSnapshotRef.current === snapshotKey) return;
    lastMicroPermissionSnapshotRef.current = snapshotKey;
    logPermissionEvent("microphone", "snapshot", {
      screen: "VideoRecorder",
      status: microphonePermission.status ?? null,
      granted: Boolean(microphonePermission.granted),
      canAskAgain: Boolean(microphonePermission.canAskAgain),
    });
  }, [microphonePermission]);

  useEffect(() => {
    let mounted = true;

    const prepareOrientation = async () => {
      try {
        await allowRotation();
        const deviceOrientation = await ScreenOrientation.getOrientationAsync();
        if (
          mounted &&
          typeof deviceOrientation === "number" &&
          deviceOrientation !== Orientation.UNKNOWN
        ) {
          orientationRef.current = deviceOrientation;
        }
      } catch (e) {
        if (__DEV__) console.warn("[VideoRecorder] init orientation failed", e?.message || e);
      }
    };

    prepareOrientation();

    const subscription = ScreenOrientation.addOrientationChangeListener(({ orientationInfo }) => {
      if (
        orientationInfo?.orientation != null &&
        orientationInfo.orientation !== Orientation.UNKNOWN
      ) {
        orientationRef.current = orientationInfo.orientation;
      } else {
        ScreenOrientation.getOrientationAsync()
          .then((deviceOrientation) => {
            if (
              typeof deviceOrientation === "number" &&
              deviceOrientation !== Orientation.UNKNOWN
            ) {
              orientationRef.current = deviceOrientation;
            }
          })
          .catch(() => {});
      }
    });

    return () => {
      mounted = false;
      ScreenOrientation.removeOrientationChangeListener(subscription);
      ScreenOrientation.lockAsync(OrientationLock.PORTRAIT).catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [allowRotation]);

  useEffect(() => {
    setCameraReady(false);
  }, [facing]);

  const startTimer = () => {
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) {
          stopRecording();
          return MAX_SECONDS;
        }
        return s + 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || recording) return;

    try {
      const deviceOrientation = await ScreenOrientation.getOrientationAsync().catch(() => null);
      if (
        typeof deviceOrientation === "number" &&
        deviceOrientation !== Orientation.UNKNOWN
      ) {
        orientationRef.current = deviceOrientation;
      }

      const clipOrientation = orientationRef.current;
      setRecording(true);
      await lockForRecording(clipOrientation);
      startTimer();

      const result = await cameraRef.current.recordAsync({
        maxDuration: MAX_SECONDS,
        quality: "720p",
        mute,
      });

      stopTimer();
      setRecording(false);
      await allowRotation();

      if (result?.uri) {
        navigation.navigate("Create", {
          screen: "CreateHome",
          params: {
            recordedVideoUri: result.uri,
            recordedDuration: seconds,
            recordedOrientation: clipOrientation,
          },
        });
      }
    } catch (e) {
      stopTimer();
      setRecording(false);
      await allowRotation();
      console.error("record error", e);
    }
  };

  const stopRecording = async () => {
    try {
      if (cameraRef.current && recording) {
        await cameraRef.current.stopRecording();
      }
    } catch (e) {
      console.error("stopRecording", e);
    } finally {
      stopTimer();
      setRecording(false);
      await allowRotation();
    }
  };

  const waitingForPermissions =
    cameraPermission == null || microphonePermission == null;

  if (waitingForPermissions || requestingPermissions) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={[styles.statusText, styles.statusTextFirst]}>
          {requestingPermissions ? "Requesting permissions..." : "Checking permissions..."}
        </Text>
      </View>
    );
  }

  const missingCamera = cameraPermission?.granted === false;
  const missingMicrophone = microphonePermission?.granted === false;
  const blockedCamera = missingCamera && cameraPermission?.canAskAgain === false;
  const blockedMicrophone =
    missingMicrophone && microphonePermission?.canAskAgain === false;
  const blocked = blockedCamera || blockedMicrophone;

  if (missingCamera || missingMicrophone) {
    return (
      <View style={styles.center}>
        <Text style={[styles.statusText, styles.statusTextFirst]}>
          We need camera
          {missingMicrophone ? " and microphone" : ""} access to record video.
        </Text>
        {!blocked && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (!requestingPermissions) {
                handleRequestPermissions("cta-button");
              }
            }}
            disabled={requestingPermissions}
          >
            <Text style={styles.primaryButtonLabel}>
              {requestingPermissions ? "Requesting..." : "Grant Access"}
            </Text>
          </TouchableOpacity>
        )}
        {blocked && (
          <Text style={styles.statusHint}>
            Enable permissions from your system settings to continue.
          </Text>
        )}
      </View>
    );
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const onPinchEvent = ({ nativeEvent }) => {
    if (!cameraReady) return;

    if (nativeEvent.state === State.BEGAN) {
      setBaseZoom(zoom);
    } else if (nativeEvent.state === State.ACTIVE) {
      const next = Math.max(0, Math.min(1, baseZoom + (nativeEvent.scale - 1) * 0.5));
      setZoom(next);
    }
  };

  return (
    <View style={styles.container}>
      <PinchGestureHandler
        onHandlerStateChange={onPinchEvent}
        onGestureEvent={onPinchEvent}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            mode="video"
            zoom={zoom}
            mute={mute}
            enableTorch={torch && facing === "back"}
            videoQuality="720p"
            videoStabilizationMode="auto"
            onCameraReady={() => setCameraReady(true)}
          />
          {!cameraReady && (
            <View style={styles.previewOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.statusText}>Starting camera...</Text>
            </View>
          )}
        </View>
      </PinchGestureHandler>
      <View style={styles.overlay}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topLeft}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.timer}>
          {mm}:{ss}
        </Text>
        <View style={styles.topRightRow}>
          <TouchableOpacity onPress={() => setTorch((v) => !v)} style={styles.topRightBtn}>
            <Ionicons name={torch ? "flash" : "flash-off"} size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFacing((t) => (t === "back" ? "front" : "back"))}
            style={styles.topRightBtn}
          >
            <Ionicons name="camera-reverse" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => setZoom((z) => Math.max(0, +(z - 0.1).toFixed(3)))}
          >
            <Ionicons name="remove" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.recordButton,
              { backgroundColor: recording ? "#ffa000" : "#e53935" },
            ]}
            onPress={recording ? stopRecording : startRecording}
          >
            <Ionicons
              name={recording ? "stop-circle" : "radio-button-on"}
              size={48}
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => setZoom((z) => Math.min(1, +(z + 0.1).toFixed(3)))}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={[styles.controlsRow, { marginTop: 10 }]}>
          <TouchableOpacity style={styles.toggleBtn} onPress={() => setMute((m) => !m)}>
            <Text style={styles.toggleText}>{mute ? "Muted" : "Audio"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  timer: { color: "#fff", fontSize: 18, fontWeight: "700" },
  topLeft: { padding: 6 },
  topRightRow: { flexDirection: "row", alignItems: "center" },
  topRightBtn: { padding: 6 },
  controls: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  controlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  smallBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#333a",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
  },
  toggleBtn: {
    backgroundColor: "#333a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 8,
  },
  toggleText: { color: "#fff", fontWeight: "700" },
  center: {
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
  previewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
