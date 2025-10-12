import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  TouchableWithoutFeedback,
} from "react-native";
import data from "@emoji-mart/data/sets/15/native.json";

const EMOJI_ITEMS = Object.values(data.emojis || {})
  .map((emoji) => {
    const primarySkin = emoji?.skins?.[0];
    if (!primarySkin?.native) return null;
    const keywords = [
      emoji.id,
      emoji.name,
      emoji.annotation,
      ...(emoji.keywords || []),
      ...(Array.isArray(emoji.shortcodes)
        ? emoji.shortcodes
        : emoji.shortcodes
        ? [emoji.shortcodes]
        : []),
    ]
      .filter(Boolean)
      .map((word) => String(word).toLowerCase());

    return {
      id: emoji.id,
      native: primarySkin.native,
      keywords,
    };
  })
  .filter(Boolean);

const DEFAULT_LIST = EMOJI_ITEMS.slice(0, 250);

export default function EmojiPickerModal({ visible, onClose, onSelect }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return DEFAULT_LIST;
    return EMOJI_ITEMS.filter((item) =>
      item.keywords.some((keyword) => keyword.includes(trimmed))
    ).slice(0, 250);
  }, [query]);

  const handleSelect = (emoji) => {
    onSelect?.(emoji);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <Text style={styles.heading}>Pick an emoji</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search emoji"
                placeholderTextColor="#888"
                style={styles.search}
                autoFocus={false}
              />
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                numColumns={8}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.emojiList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleSelect(item)}
                    style={styles.emojiButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emojiText}>{item.native}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No emoji found</Text>
                }
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1f1f1f",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#555",
    marginBottom: 12,
  },
  heading: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  search: {
    backgroundColor: "#2d2d2d",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  emojiList: {
    paddingBottom: 8,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 8,
  },
  emojiButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  emojiText: {
    fontSize: 24,
  },
  emptyText: {
    color: "#bbb",
    textAlign: "center",
    marginTop: 40,
  },
});
