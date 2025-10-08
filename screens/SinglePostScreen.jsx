import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Text, ScrollView, TouchableOpacity } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../styles/ThemeContext";
import supabase from "../supabase/client";
import PostCard from "../components/posts/PostCard";

export default function SinglePostScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { postId, commentId } = route.params || {};
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadPost = async () => {
    if (!postId) return;
    setLoading(true);
    try {
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
        .eq("id", postId)
        .maybeSingle();
      if (error) throw error;
      setPost(data || null);
    } catch (e) {
      console.error("SinglePost load:", e.message);
      setPost(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPost(); }, [postId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Post not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Post</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        <PostCard post={post} user={null} initialCommentId={commentId} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerIcon: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSpacer: { width: 24 },
});
