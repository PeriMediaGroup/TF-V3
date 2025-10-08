import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const API_BASE = "https://api.giphy.com/v1/gifs";
const DEFAULT_LIMIT = 24;

const buildGifSource = (gif) => {
  if (!gif) return null;
  const images = gif.images || {};
  return (
    (images.fixed_width_downsampled && images.fixed_width_downsampled.url) ||
    (images.fixed_width && images.fixed_width.url) ||
    (images.downsized_medium && images.downsized_medium.url) ||
    (images.original && images.original.url) ||
    null
  );
};

export default function GiphyPickerSheet({
  visible,
  onClose,
  onSelect,
  theme,
  initialQuery = "",
}) {
  const apiKey = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
  const [query, setQuery] = useState(initialQuery);
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState({ offset: 0, totalCount: null });
  const queryRef = useRef(initialQuery);

  const canLoadMore = useMemo(() => {
    if (page.totalCount == null) return true;
    return gifs.length < page.totalCount;
  }, [gifs.length, page.totalCount]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const fetchGifs = useCallback(
    async ({ search, offset = 0, append = false }) => {
      if (!apiKey) {
        setError("Missing GIPHY API key");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const baseUrl = search && search.length > 0 ? API_BASE + "/search" : API_BASE + "/trending";
        const params =
          "?api_key=" +
          apiKey +
          (search && search.length > 0 ? "&q=" + encodeURIComponent(search) : "") +
          "&limit=" + DEFAULT_LIMIT +
          "&offset=" + offset;
        const response = await fetch(baseUrl + params);
        if (!response.ok) {
          throw new Error("GIPHY request failed (" + response.status + ")");
        }
        const json = await response.json();
        const list = Array.isArray(json.data) ? json.data : [];
        const pagination = json.pagination || {};
        setPage({ offset: pagination.offset || 0, totalCount: pagination.total_count ?? null });
        setGifs((prev) => (append ? prev.concat(list) : list));
      } catch (err) {
        setError(err.message || String(err));
        if (!append) setGifs([]);
      } finally {
        setLoading(false);
      }
    },
    [apiKey]
  );

  useEffect(() => {
    if (!visible) return;
    setGifs([]);
    setPage({ offset: 0, totalCount: null });
    setError(null);
    const searchTerm = queryRef.current?.trim?.() ?? "";
    fetchGifs({ search: searchTerm, offset: 0, append: false });
  }, [visible, fetchGifs]);

  useEffect(() => {
    if (!visible) return;
    const handler = setTimeout(() => {
      fetchGifs({ search: query.trim(), offset: 0, append: false });
    }, 350);
    return () => clearTimeout(handler);
  }, [query, fetchGifs, visible]);

  const loadMore = () => {
    if (loading || !canLoadMore) return;
    const nextOffset = gifs.length;
    fetchGifs({ search: query.trim(), offset: nextOffset, append: true });
  };

  const handleSelect = (gif) => {
    const url = buildGifSource(gif);
    if (!url) return;
    onSelect?.({
      id: gif.id,
      url,
      preview: (gif.images && gif.images.preview_gif && gif.images.preview_gif.url) || url,
      original: (gif.images && gif.images.original && gif.images.original.url) || url,
      data: gif,
    });
    onClose?.();
  };

  const renderItem = ({ item }) => {
    const uri = buildGifSource(item);
    if (!uri) return null;
    return (
      <TouchableOpacity style={styles.tile} onPress={() => handleSelect(item)} activeOpacity={0.8}>
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme?.background || "#111" }]}> 
        <View style={[styles.header, { borderBottomColor: theme?.border || "#333" }]}> 
          <Text style={[styles.title, { color: theme?.text || "#fff" }]}>Pick a GIF</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={theme?.text || "#fff"} />
          </TouchableOpacity>
        </View>
        {apiKey ? (
          <>
            <View style={[styles.searchRow, { borderColor: theme?.border || "#333" }]}> 
              <Ionicons name="search" size={18} color={theme?.muted || "#aaa"} style={{ marginRight: 6 }} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search GIFs"
                placeholderTextColor={theme?.muted || "#888"}
                style={[styles.searchInput, { color: theme?.text || "#fff" }]}
              />
            </View>
            {error ? (
              <View style={styles.center}>
                <Text style={{ color: theme?.text || "#fff", marginBottom: 8 }}>{error}</Text>
                <TouchableOpacity onPress={() => fetchGifs({ search: query.trim(), offset: 0, append: false })}>
                  <Text style={{ color: theme?.primary || "#f00" }}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={gifs}
                numColumns={3}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.grid}
                onEndReached={loadMore}
                onEndReachedThreshold={0.6}
                ListFooterComponent={
                  loading ? (
                    <View style={styles.footerLoading}>
                      <ActivityIndicator color={theme?.primary || "#f00"} />
                    </View>
                  ) : null
                }
              />
            )}
          </>
        ) : (
          <View style={styles.center}>
            <Text style={{ color: theme?.text || "#fff", textAlign: "center" }}>
              Set EXPO_PUBLIC_GIPHY_API_KEY in your environment to enable GIF search.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 36,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 6,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.select({ ios: 10, android: 6 }),
  },
  grid: {
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
  tile: {
    width: "31%",
    aspectRatio: 1,
    margin: "1.33%",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  footerLoading: {
    paddingVertical: 16,
  },
});
