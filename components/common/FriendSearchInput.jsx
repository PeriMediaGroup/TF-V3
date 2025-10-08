import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useTheme } from "../../styles/ThemeContext";
import supabase from "../../supabase/client";

export default function FriendSearchInput({ value, onChange, placeholder }) {
  const { theme } = useTheme();
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const runSearch = async (text) => {
    if (!text || text.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, profile_image_url")
      .ilike("username", `%${text}%`)
      .limit(5);
    if (!error) setResults(data || []);
    setLoading(false);
  };

  const onChangeDebounced = (text) => {
    setQuery(text);
    onChange?.(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(text), 250);
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.mutedText || "#999"}
        style={[
          styles.input,
          {
            borderColor: "#555",
            color: theme.text,
            backgroundColor: theme.card,
          },
        ]}
        value={query}
        onChangeText={onChangeDebounced}
        autoCapitalize="none"
      />
      {loading && <ActivityIndicator style={styles.spinner} />}

      {!!results.length && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          style={[
            styles.dropdown,
            {
              backgroundColor: theme.card,
              borderColor: "#444",
              shadowColor: "#000",
            },
          ]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                onChange?.(item.username);
                setQuery(item.username);
                setResults([]);
              }}
            >
              <Text style={{ color: "#000" }}>{item.username}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  input: {
    width: "75%",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  spinner: { position: "absolute", right: 10, top: 12 },
dropdown: {
  position: "absolute",
  top: Platform.OS === "ios" ? 50 : 48, // just below the input
  left: 0,
  right: 0,
  backgroundColor: "#fff",
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 8,
  maxHeight: 200,
  zIndex: 100,
  elevation: 6,
},
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    backgroundColor: "#fff",
  },
});
