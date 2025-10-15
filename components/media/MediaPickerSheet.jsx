import React, { useEffect, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

export default function MediaPickerSheet({
  visible,
  onClose,
  mode = "photo", // 'photo' | 'video'
  maxCount = 5,
  onAdd, // (uris: string[]) => void
  theme,
  onRecordVideo, // () => void
}) {
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [assets, setAssets] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [selected, setSelected] = useState([]); // uris
  const isVideo = mode === "video";

  const load = useCallback(
    async (after = null) => {
      try {
        const res = await MediaLibrary.getAssetsAsync({
          mediaType: isVideo ? "video" : "photo",
          first: 60,
          sortBy: MediaLibrary.SortBy.creationTime,
          after,
        });
        setAssets((prev) => (after ? [...prev, ...res.assets] : res.assets));
        setCursor(res.endCursor || null);
      } catch {}
    },
    [isVideo]
  );

  useEffect(() => {
    if (!visible) return;
    (async () => {
      if (!permission || !permission.granted) {
        await requestPermission();
      }
      setSelected([]);
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode]);

  const toggle = (uri) => {
    setSelected((prev) => {
      if (isVideo) return [uri];
      const exists = prev.includes(uri);
      if (exists) return prev.filter((u) => u !== uri);
      if (prev.length >= maxCount) return prev; // cap
      return [...prev, uri];
    });
  };

  const cameraAction = async () => {
    try {
      if (isVideo) {
        onClose?.();
        onRecordVideo?.();
        return;
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm?.granted) {
        if (perm?.canAskAgain) {
          // user dismissed without granting; nothing to do yet
          return;
        }
        onClose?.();
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        videoMaxDuration: 30,
        quality: 1,
      });
      if (!res.canceled) {
        onAdd?.([res.assets[0].uri]);
        onClose?.();
      }
    } catch {}
  };

  const confirm = () => {
    if (!selected.length) return onClose?.();
    onAdd?.(selected);
    onClose?.();
  };

  const renderItem = ({ item, index }) => {
    if (index === 0) {
      return (
        <TouchableOpacity
          style={[styles.tile, { backgroundColor: theme?.card }]}
          onPress={cameraAction}
        >
          <Ionicons
            name={isVideo ? "videocam" : "camera"}
            size={32}
            color={theme?.text || "#fff"}
          />
        </TouchableOpacity>
      );
    }
    const asset = assets[index - 1];
    const uri = asset?.uri;
    const picked = selected.includes(uri);
    return (
      <TouchableOpacity style={styles.tile} onPress={() => toggle(uri)}>
        <Image source={{ uri }} style={styles.thumb} />
        {picked && (
          <View
            style={[
              styles.check,
              {
                borderColor: theme?.background,
                backgroundColor: theme?.primary,
              },
            ]}
          >
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const data = [{ key: "camera" }, ...assets];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: theme?.background }]}>
        <View style={[styles.header, { borderBottomColor: theme?.border }]}>
          <Text style={[styles.title, { color: theme?.text }]}>
            {isVideo ? "Select Video" : "Select Photos"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: theme?.primary }}>Close</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={data}
          numColumns={3}
          renderItem={renderItem}
          keyExtractor={(item, idx) => String(item.id || item.key || idx)}
          contentContainerStyle={{ padding: 8 }}
          onEndReached={() => cursor && load(cursor)}
          onEndReachedThreshold={0.4}
        />
        <View
          style={[
            styles.footer,
            { borderTopColor: theme?.border, backgroundColor: theme?.surface },
          ]}
        >
          <Text style={{ color: theme?.text }}>
            {isVideo
              ? selected.length
                ? "1 selected"
                : "Select one video"
              : `${selected.length}/${maxCount} selected`}
          </Text>
          <TouchableOpacity
            onPress={confirm}
            disabled={!selected.length}
            style={[
              styles.addBtn,
              {
                backgroundColor: selected.length
                  ? theme?.primary
                  : theme?.cardSoft,
              },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 35 },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "700" },
  tile: {
    width: "31%",
    aspectRatio: 1,
    margin: "1%",
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: { width: "100%", height: "100%" },
  check: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
});
