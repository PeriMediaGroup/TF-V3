import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import {
  Image,
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useAuth } from "../auth/AuthContext";
import supabase from "../supabase/client";
import { useTheme } from "../styles/ThemeContext";
import { fetchProfileStats } from "../supabase/helpers";

dayjs.extend(utc);

export default function ProfileScreen({ navigation: navigationProp }) {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, logOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ postCount: 0, friendCount: 0, rank: "Fresh Mag" });
  const isFocused = useIsFocused(); // ✅ true whenever Profile tab is visible

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "profile_image_url, username, about, email, first_name, last_name, city, state, rank, top_guns, top_friends, created_at"
        )
        .eq("id", user.id)
        .eq("is_deleted", false)
        .single();

      if (error) throw error;
      setProfile(data);

      const profileStats = await fetchProfileStats(user.id);
      setStats(profileStats);
    } catch (err) {
      console.error("Error loading profile:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadProfile();
    }
  }, [isFocused, user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" style={{ color: theme.primary }} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { color: theme.text }]}>
          Profile not found
        </Text>
        <Button title="Log Out" onPress={logOut} />
      </View>
    );
  }

  const joinedLabel = profile?.created_at
    ? dayjs.utc(profile.created_at).local().format("MMM D, YYYY")
    : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.container, { paddingBottom: 80 }]}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled={true} // 👈 add this
      keyboardDismissMode="on-drag"
    >
      <View
        style={[
          styles.avatarWrap,
          { borderColor: theme.border, backgroundColor: theme.card },
        ]}
      >
        <Image
          source={
            profile?.profile_image_url
              ? { uri: profile.profile_image_url }
              : require("../assets/images/default-avatar.png")
          }
          style={styles.avatar}
          resizeMode="cover"
        />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>
        {profile.username || "No username"}
      </Text>
      <Text style={[styles.info, { color: theme.text }]}>
        {profile.first_name} {profile.last_name}
      </Text>
      <Text style={[styles.info, { color: theme.text }]}>
        {profile.about || "No about set"}
      </Text>
      <Text style={styles.meta}>Email: {profile.email}</Text>
      <Text style={styles.meta}>
        City: {profile.city || "-"} | State: {profile.state || "-"}
      </Text>
      <Text style={styles.meta}>Rank: {stats.rank || profile.rank || "Fresh Mag"}</Text>

      <View style={styles.statsRow}>
        {joinedLabel && (
          <View style={[styles.statCard, { backgroundColor: theme.card }]}
          >
            <Ionicons name="calendar-outline" size={16} color={theme.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.statText, { color: theme.text }]}>Joined {joinedLabel}</Text>
          </View>
        )}
        <View style={[styles.statCard, { backgroundColor: theme.card }]}
        >
          <Ionicons name="newspaper-outline" size={16} color={theme.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.statText, { color: theme.text }]}>{stats.postCount} Posts</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}
        >
          <Ionicons name="people-outline" size={16} color={theme.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.statText, { color: theme.text }]}>{stats.friendCount} Friends</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Top 5 Guns
      </Text>
      {profile.top_guns?.length ? (
        profile.top_guns.map((gun, i) => (
          <Text key={i} style={[styles.meta, { color: theme.text }]}>
            {i + 1}. {gun}
          </Text>
        ))
      ) : (
        <Text style={[styles.meta, { color: theme.text }]}>Not set yet</Text>
      )}

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Top 5 Friends
      </Text>
      {profile.top_friends?.length ? (
        profile.top_friends.map((friend, i) => (
          <Text
            key={i}
            style={[styles.meta, { color: theme.primary }]}
            onPress={() =>
              navigation.navigate("PublicProfile", { username: friend })
            }
          >
            {i + 1}. {friend}
          </Text>
        ))
      ) : (
        <Text style={[styles.meta, { color: theme.text }]}>Not set yet</Text>
      )}

      <View style={styles.button}>
        <Button
          title="Invite a Friend"
          onPress={() => navigation.navigate("InviteFriend")}
        />
      </View>
      <View style={styles.button}>
        <Button
          title="Edit Profile"
          onPress={() => navigation.navigate("EditProfile")}
        />
      </View>
      <View style={styles.button}>
        <Button title="Log Out" onPress={logOut} />
      </View>
      <View style={styles.button}>
        <Button
          title="Settings"
          onPress={() => navigation.navigate("Settings")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 8 },
  info: { fontSize: 16, marginBottom: 8, textAlign: "center" },
  meta: { fontSize: 14, color: "#666", marginBottom: 6 },
  button: { marginTop: 10, width: "60%" },
  avatarWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    alignSelf: "center",
  },
  statsRow: {
    width: "100%",
    marginBottom: 16,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  statText: {
    fontSize: 14,
    fontWeight: "600",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
});
