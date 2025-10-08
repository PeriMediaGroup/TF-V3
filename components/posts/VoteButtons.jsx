// components/VoteButtons.jsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../styles/ThemeContext"; // ← fix path for your tree
import { handleVote, fetchVoteCounts } from "../../supabase/helpers"; // ← matches helpers above

export default function VoteButtons({ postId, userId }) {
  const { theme } = useTheme();
  const [up, setUp] = useState(0);
  const [down, setDown] = useState(0);
  const [userVote, setUserVote] = useState(null); // "up" | "down" | null

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const res = await fetchVoteCounts(postId, userId);
      if (!mounted) return;
      setUp(res.up);
      setDown(res.down);
      setUserVote(res.userVote);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [postId, userId]);

  const onPress = async (type) => {
    const res = await handleVote(postId, userId, type);
    setUp(res.up);
    setDown(res.down);
    setUserVote(res.userVote);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.pill, { backgroundColor: theme.background, shadowColor: theme.border,}]}>
        <Pressable
          style={({ pressed }) => [
            styles.half,
            styles.left,
            { borderRightColor: theme.border, backgroundColor: pressed ? theme.cardSoft : "transparent" },
          ]}
          onPress={() => onPress("up")}
          android_ripple={{ color: theme.text }}
        >
          <Text style={[styles.symbol, { color: userVote === "up" ? theme.primary : theme.text }]}>+</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.half,
            styles.right,
            { backgroundColor: pressed ? theme.cardSoft : "transparent" },
          ]}
          onPress={() => onPress("down")}
          android_ripple={{ color: theme.cardSoft }}
        >
          <Text style={[styles.symbol, { color: userVote === "down" ? theme.primary : theme.text }]}>-</Text>
        </Pressable>
      </View>

      <View style={styles.countRow}>
        <Text style={[styles.count, { color: userVote === "up" ? theme.primary : theme.text }]}>{up}</Text>
        <Text style={[styles.count, { color: userVote === "down" ? theme.primary : theme.text }]}>-{down}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: 8 },
  pill: {
    flexDirection: "row",
    borderRadius: 18,
    overflow: "hidden",
    elevation: 3,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  half: { paddingVertical: 8, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  left: { borderRightWidth: StyleSheet.hairlineWidth },
  right: {},
  symbol: { fontSize: 18, fontWeight: "800" },
  countRow: { flexDirection: "row", width: 70, justifyContent: "space-between", marginTop: 4 },
  count: { fontSize: 16, fontWeight: "700" },
});
