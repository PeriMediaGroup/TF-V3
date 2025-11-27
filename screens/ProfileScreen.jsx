import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import {
  Image,
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useAuth } from "../auth/AuthContext";
import supabase from "../supabase/client";
import { useTheme } from "../styles/ThemeContext";
import { fetchProfileStats } from "../supabase/helpers";
import ScreenHeader from "../components/common/ScreenHeader";
import CreatePostFab from "../components/common/CreatePostFab";
import TfButton from "../components/common/TfButton";

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
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Profile not found</Text>
        <View style={styles.actionList}>
          <TfButton
            label="Log Out"
            onPress={logOut}
            style={styles["actionList__button"]}
          />
        </View>
      </View>
    );
  }

  const joinedLabel = profile?.created_at
    ? dayjs.utc(profile.created_at).local().format("MMM D, YYYY")
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingBottom: 80 }]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        keyboardDismissMode="on-drag"
      >
      <ScreenHeader title="Profile" />
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

      <View style={[styles.topFiveSection, { borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          The Top Five
        </Text>
        <View style={styles.topFiveColumns}>
          <View style={styles.topFiveColumn}>
            <Text style={[styles.topFiveSubheading, { color: theme.muted }]}>Guns</Text>
            {profile.top_guns?.length ? (
              profile.top_guns.map((gun, i) => (
                <Text key={i} style={[styles.meta, { color: theme.text }]}>
                  {i + 1}. {gun}
                </Text>
              ))
            ) : (
              <Text style={[styles.meta, { color: theme.text }]}>Not set yet</Text>
            )}
          </View>
          <View style={styles.topFiveColumn}>
            <Text style={[styles.topFiveSubheading, { color: theme.muted }]}>Friends</Text>
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
          </View>
        </View>
      </View>

      <View style={styles.actionList}>
        <TfButton
          label="Invite a Friend"
          onPress={() => navigation.navigate("InviteFriend")}
          style={styles["actionList__button"]}
        />
        <TfButton
          label="Edit Profile"
          onPress={() => navigation.navigate("EditProfile")}
          style={styles["actionList__button"]}
        />
        <TfButton
          label="Settings"
          onPress={() => navigation.navigate("Settings")}
          style={styles["actionList__button"]}
        />
        <TfButton
          label="Log Out"
          onPress={logOut}
          style={styles["actionList__button"]}
        />
      </View>
      </ScrollView>
      <CreatePostFab />
    </View>
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
  actionList: {
    width: "100%",
    marginTop: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  "actionList__button": {
    marginTop: 12,
    alignSelf: "stretch",
  },
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
  topFiveSection: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  topFiveColumns: {
    flexDirection: "row",
    columnGap: 16,
    marginTop: 8,
  },
  topFiveColumn: {
    flex: 1,
  },
  topFiveSubheading: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
});
