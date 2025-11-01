import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import supabase from "../supabase/client";
import { Colors } from "../styles/GlobalStyles";
import { useTheme } from "../styles/ThemeContext";
import { useAuth } from "../auth/AuthContext";
import {
  fetchProfileStats,
  fetchFriendRelationship,
  sendFriendRequest,
  respondToFriendRequest,
} from "../supabase/helpers";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export default function PublicProfileScreen() {
  const navigation = useNavigation();
  const { user, profile: authProfile } = useAuth();
  const { theme } = useTheme();
  const route = useRoute();
  const { username, userId } = route.params || {}; // support username or userId
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ postCount: 0, friendCount: 0, rank: "Fresh Mag" });
  const [relationship, setRelationship] = useState({ status: "none", request: null });
  const [actionLoading, setActionLoading] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("profiles")
        .select(
          `
          id,
          username,
          first_name,
          last_name,
          city,
          state,
          rank,
          about,
          profile_image_url,
          top_guns,
          top_friends,
          created_at
        `
        );
      if (userId) {
        query = query.eq("id", userId);
      } else if (username) {
        query = query.eq("username", username);
      } else {
        throw new Error("No username or userId provided");
      }
      query = query.eq("is_deleted", false);
      const { data, error } = await query.single();

      if (error) throw error;
      setProfile(data);

      const statInfo = await fetchProfileStats(data.id);
      setStats(statInfo);

      if (user?.id && data?.id) {
        const relation = await fetchFriendRelationship(user.id, data.id);
        setRelationship(relation);
      } else {
        setRelationship({ status: "none" });
      }
    } catch (err) {
      console.error("Error loading profile:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [username, userId, user?.id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.crimson} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}> 
        <Text style={{ color: theme.text }}>Profile not found</Text>
      </View>
    );
  }

  const isSelf = user?.id && profile?.id && user.id === profile.id;

  const shareProfile = async () => {
    if (!profile?.username) return;
    try {
      await Share.share({
        message: `Check out ${profile.username} on TriggerFeed: https://triggerfeed.com/user/${profile.username}`,
      });
    } catch (err) {
      Alert.alert("Share failed", err?.message || "Unable to share this profile right now.");
    }
  };

  const handleAddFriend = async () => {
    if (!user?.id || !profile?.id) return;
    setActionLoading(true);
    const result = await sendFriendRequest({
      fromUserId: user.id,
      toUserId: profile.id,
      fromUsername: authProfile?.username || null,
    });
    setActionLoading(false);
    if (result.success) {
      setRelationship({ status: "outgoing", request: result.request });
      Alert.alert("Request sent", "They'll get a notification to respond.");
      return;
    }

    if (result.error === "outgoing") {
      setRelationship({ status: "outgoing", request: result.request });
      Alert.alert("Pending", "You already have a pending friend request with this user.");
      return;
    }

    if (result.error === "incoming") {
      setRelationship({ status: "incoming", request: result.request });
      Alert.alert("Pending", "This user has already sent you a request. Respond above.");
      return;
    }

    if (result.error === "already-friends") {
      setRelationship({ status: "friends" });
      Alert.alert("Friends", "You are already friends with this user.");
      return;
    }

    Alert.alert("Could not send request", result.error || "Please try again later.");
  };

  const respondToIncoming = async (accept) => {
    if (!relationship.request || !user?.id || !profile?.id) return;
    setActionLoading(true);
      const res = await respondToFriendRequest({
        requesterId: relationship.request.requesterId,
        receiverId: relationship.request.receiverId,
        accept,
        currentUserId: user.id,
        otherUserId: profile.id,
        currentUsername: authProfile?.username || null,
      });
    setActionLoading(false);
    if (res.success) {
      const nextStatus = accept ? "friends" : "none";
      setRelationship(
        nextStatus === "none"
          ? { status: "none" }
          : { status: nextStatus, request: relationship.request }
      );
      if (accept) {
        const updatedStats = await fetchProfileStats(profile.id);
        setStats(updatedStats);
      }
    } else {
      Alert.alert("Action failed", res.error || "Please try again.");
    }
  };

  const joinedLabel = profile?.created_at
    ? dayjs.utc(profile.created_at).local().format("MMM D, YYYY")
    : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
      <View
        style={[
          styles.avatarWrap,
          { borderColor: theme.border, backgroundColor: theme.card },
        ]}
      >
        {profile.profile_image_url ? (
          <Image
            source={{ uri: profile.profile_image_url }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <Image
            source={require("../assets/images/default-avatar.png")}
            style={styles.avatar}
            resizeMode="cover"
          />
        )}
      </View>

      <Text style={[styles.title, { color: theme.text }]}> 
        {profile.username}
      </Text>

      <View style={styles.badgeRow}>
        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: theme.primary }]}
          onPress={shareProfile}
          activeOpacity={0.85}
        >
          <Ionicons name="share-social-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.shareText}>Share Profile</Text>
        </TouchableOpacity>

        {!isSelf && user?.id && relationship.status && (
          relationship.status === "incoming" && relationship.request ? (
            <View style={[styles.incomingRow, { marginLeft: 12 }]}>
              <TouchableOpacity
                style={[styles.friendButton, { backgroundColor: theme.primary, marginRight: 8 }]}
                onPress={() => respondToIncoming(true)}
                disabled={actionLoading}
              >
                <Text style={styles.friendButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.friendButton, { backgroundColor: theme.card }]}
                onPress={() => respondToIncoming(false)}
                disabled={actionLoading}
              >
                <Text style={[styles.friendButtonText, { color: theme.text }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          ) : relationship.status === "outgoing" ? (
            <TouchableOpacity
              style={[styles.friendButton, { backgroundColor: theme.card, marginLeft: 12 }]} 
              onPress={handleAddFriend}
              disabled={actionLoading || relationship.status === "friends" || relationship.status === "outgoing"}
            >
              <Text style={[styles.friendButtonText, { color: theme.text }]}
              >
                {relationship.status === "friends"
                  ? "Friends"
                  : relationship.status === "outgoing"
                    ? "Request Sent"
                    : "Add Friend"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.friendButton, { backgroundColor: theme.card, marginLeft: 12 }]} 
              onPress={handleAddFriend}
              disabled={actionLoading || relationship.status === "friends"}
            >
              <Text style={[styles.friendButtonText, { color: theme.text }]}
              >
                {relationship.status === "friends" ? "Friends" : "Add Friend"}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <Text style={[styles.meta, { color: theme.text }]}>
        {profile.first_name} {profile.last_name}
      </Text>

      <Text style={[styles.meta, { color: theme.text }]}>
        City: {profile.city || "-"} | State: {profile.state || "-"}
      </Text>

      <Text style={[styles.meta, { color: theme.text }]}> 
        Rank: {stats.rank || profile.rank || "Fresh Mag"}
      </Text>

      <View style={styles.statsRow}>
        {joinedLabel && (
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Ionicons name="calendar-outline" size={16} color={theme.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.statText, { color: theme.text }]}>Joined {joinedLabel}</Text>
          </View>
        )}
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Ionicons name="newspaper-outline" size={16} color={theme.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.statText, { color: theme.text }]}>{stats.postCount} Posts</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Ionicons name="people-outline" size={16} color={theme.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.statText, { color: theme.text }]}>{stats.friendCount} Friends</Text>
        </View>
      </View>

      <Text style={[styles.about, { color: theme.text }]}>
        {profile.about || "No bio yet"}
      </Text>

      <View>
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
              style={[styles.meta, { color: theme.text }]}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 8 },
  meta: { fontSize: 14, marginBottom: 6 },
  about: {
    fontSize: 16,
    fontStyle: "italic",
    marginVertical: 10,
    textAlign: "center",
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
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  shareText: {
    color: "#fff",
    fontWeight: "600",
  },
  friendButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  friendButtonText: {
    fontWeight: "600",
  },
  incomingRow: {
    flexDirection: "row",
    alignItems: "center",
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
    marginBottom: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
