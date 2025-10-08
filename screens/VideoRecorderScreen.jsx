import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as ScreenOrientation from 'expo-screen-orientation';
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

const MAX_SECONDS = 90;
const { Orientation, OrientationLock } = ScreenOrientation;
export default function VideoRecorderScreen() {
  const navigation = useNavigation();
  const cameraRef = useRef(null);
  const orientationRef = useRef(Orientation.PORTRAIT_UP);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const micPermissionsHook =
    typeof useMicrophonePermissions === "function"
      ? useMicrophonePermissions()
      : [{ granted: true }, async () => true];
  const [microphonePermission, requestMicrophonePermission] = micPermissionsHook;
  const [recording, setRecording] = useState(false);
  const [facing, setFacing] = useState("back"); // 'back' | 'front'
  const [seconds, setSeconds] = useState(0);
  const [zoom, setZoom] = useState(0); // 0..1
  const [baseZoom, setBaseZoom] = useState(0);
  const [torch, setTorch] = useState(false);
  const [mute, setMute] = useState(false);
  const timerRef = useRef(null);

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

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!cameraPermission?.granted) await requestCameraPermission();
      if (!microphonePermission?.granted && requestMicrophonePermission)
        await requestMicrophonePermission();

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
    })();

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
  }, [
    allowRotation,
    cameraPermission?.granted,
    microphonePermission?.granted,
    requestCameraPermission,
    requestMicrophonePermission,
  ]);

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

  if (cameraPermission == null) {
    return (
      <View style={styles.center}>
        <Text>Requesting permissions...</Text>
      </View>
    );
  }
  if (!cameraPermission.granted) {
    return (
      <View style={styles.center}>
        <Text>No access to camera/microphone</Text>
      </View>
    );
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const onPinchEvent = ({ nativeEvent }) => {
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
        <View style={{ flex: 1 }}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            mode="video"
            zoom={zoom}
            enableTorch={torch && facing === "back"}
            videoQuality="720p"
          />
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});






