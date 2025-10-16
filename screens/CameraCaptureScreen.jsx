import { Camera } from "expo-camera";
import { useState, useEffect, useRef } from "react";
import { View, Text, Button, StyleSheet } from "react-native";

export default function CameraCaptureScreen() {
  const [status, setStatus] = useState("checking");
  const camRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const permissionPromise = Camera.requestCameraPermissionsAsync();
        const result = await Promise.race([
          permissionPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 1000)
          ),
        ]);
        console.log("Camera permission result:", result);
        setStatus(result.status);
      } catch (e) {
        console.log("Camera permission error:", e);
        setStatus("timeout");
      }
    })();
  }, []);

  if (status !== "granted") {
    return (
      <View style={styles.center}>
        <Text>Permission: {status}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera ref={camRef} style={styles.camera} type="back" ratio="16:9" />
      <View style={styles.center}>
        <Button
          title="Snap test"
          onPress={async () => {
            try {
              const photo = await camRef.current.takePictureAsync();
              console.log("Captured photo:", photo?.uri);
            } catch (e) {
              console.log("Snap error:", e);
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1, width: "100%", height: "100%" },
  center: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: 10,
  },
});
