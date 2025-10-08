import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, FlatList, StyleSheet, Text } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useTheme } from "../styles/ThemeContext";
import supabase from "../supabase/client";
import PostCard from "../components/posts/PostCard";

export default function TaggedFeedScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const { tag } = route.params || {};
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  const loadPosts = useCallback(async () => {
    if (!tag) return;
    try {
      setLoading(true);
      const like = `%${tag}%`;
      const { data, error } = await supabase
        .from("posts")
        .select(`
          id,
          user_id,
          title,
          description,
          image_url,
          gif_url,
          video_url,
          created_at,
          profiles ( username, profile_image_url ),
          post_images ( id, url )
        `)
        .eq("visibility", "public")
        .or(`title.ilike.${like},description.ilike.${like}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPosts(data || []);
    } catch (e) {
      console.error("TaggedFeed load:", e.message);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!posts.length) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.text }}>No posts for #{tag}</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={posts}
      renderItem={({ item }) => <PostCard post={item} user={null} />}
      keyExtractor={(item, idx) => (item?.id ?? `post-${idx}`).toString()}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: theme.background }}
      removeClippedSubviews
      initialNumToRender={6}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});

