import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import supabase from "../../supabase/client";
import { useTheme } from "../../styles/ThemeContext";

const isBoundary = (char) => !char || /\s|[()\[\]{}.,!?;:'"`~]/.test(char);

const locateMention = (text, cursor) => {
  if (cursor == null) return null;
  const uptoCursor = text.slice(0, cursor);
  const atIndex = uptoCursor.lastIndexOf("@");
  if (atIndex < 0) return null;
  if (atIndex > 0 && !isBoundary(uptoCursor[atIndex - 1])) return null;
  const token = uptoCursor.slice(atIndex + 1);
  if (/\s/.test(token)) return null;
  return { start: atIndex, query: token };
};

const MentionInputInner = (
  {
    value,
    onChangeText,
    multiline = false,
    placeholder,
    style,
    inputStyle,
    currentUsername,
    maxSuggestions = 6,
    ...rest
  },
  forwardedRef
) => {
  const { theme } = useTheme();
  const inputRef = useRef(null);
  const [selection, setSelection] = useState({ start: value?.length || 0, end: value?.length || 0 });
  const selectionRef = useRef(selection);
  const [activeMention, setActiveMention] = useState(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const updateMentionState = useCallback(
    (text, cursor) => {
      const match = locateMention(text, cursor);
      if (!match) {
        setActiveMention(null);
        setQuery("");
        setSuggestions([]);
        return;
      }
      setActiveMention({ start: match.start });
      setQuery(match.query || "");
    },
    []
  );

  useEffect(() => {
    updateMentionState(value || "", selection.start);
  }, [value, selection.start, updateMentionState]);

  useEffect(() => {
    if (!activeMention) return;
    const trimmed = (query || "").trim();
    if (!trimmed) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("username")
          .ilike("username", `${trimmed}%`)
          .limit(maxSuggestions);
        if (cancelled) return;
        if (error) {
          setSuggestions([]);
        } else {
          const filtered = (data || [])
            .map((row) => row.username)
            .filter(Boolean)
            .filter((username) => !currentUsername || username.toLowerCase() !== currentUsername.toLowerCase());
          setSuggestions(filtered);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeMention, query, currentUsername, maxSuggestions]);

  const handleSelectionChange = useCallback(({ nativeEvent: { selection } }) => {
    setSelection(selection);
  }, []);

  const handleChange = useCallback(
    (text) => {
      onChangeText?.(text);
      updateMentionState(text, selectionRef.current.start);
    },
    [onChangeText, updateMentionState]
  );

  const insertMention = useCallback(
    (username) => {
      if (!activeMention) return;
      const cursor = selectionRef.current.start;
      const before = (value || "").slice(0, activeMention.start);
      const after = (value || "").slice(cursor);
      const insertion = `@${username} `;
      const nextValue = before + insertion + after;
      const newCursor = before.length + insertion.length;
      onChangeText?.(nextValue);
      const nextSelection = { start: newCursor, end: newCursor };
      setSelection(nextSelection);
      selectionRef.current = nextSelection;
      setActiveMention(null);
      setQuery("");
      setSuggestions([]);
      requestAnimationFrame(() => {
        inputRef.current?.setNativeProps({ selection: nextSelection });
      });
    },
    [activeMention, onChangeText, value]
  );

  useImperativeHandle(forwardedRef, () => ({
    focus: () => inputRef.current?.focus?.(),
    blur: () => inputRef.current?.blur?.(),
    getNode: () => inputRef.current,
  }));

  const suggestionList = useMemo(() => {
    if (!activeMention || (!suggestions.length && !loading)) return null;
    return (
      <View style={[styles.suggestionBox(theme), rest.suggestionsContainerStyle]}>
        {loading && !suggestions.length ? (
          <Text style={[styles.suggestionText(theme), rest.suggestionTextStyle]}>Searching…</Text>
        ) : (
          suggestions.map((username) => (
            <TouchableOpacity
              key={username}
              style={[styles.suggestionRow(theme), rest.suggestionItemStyle]}
              onPress={() => insertMention(username)}
              activeOpacity={0.85}
            >
              <Text style={[styles.suggestionText(theme), rest.suggestionTextStyle]}>@{username}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  }, [activeMention, suggestions, loading, insertMention, theme, rest]);

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={rest.placeholderTextColor || theme.muted}
        style={[styles.input(theme), inputStyle]}
        selection={selection}
        onSelectionChange={handleSelectionChange}
        autoCapitalize={rest.autoCapitalize ?? "sentences"}
        autoCorrect={rest.autoCorrect ?? true}
        {...rest}
      />
      {suggestionList}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    width: "100%",
  },
  input: (theme) => ({
    color: theme.text,
  }),
  suggestionBox: (theme) => ({
    position: "absolute",
    left: 0,
    right: 0,
    top: Platform.OS === "android" ? undefined : "100%",
    marginTop: 4,
    backgroundColor: theme.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    zIndex: 50,
  }),
  suggestionRow: (theme) => ({
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.card,
  }),
  suggestionText: (theme) => ({
    color: theme.text,
    fontSize: 14,
  }),
});

export default forwardRef(MentionInputInner);
