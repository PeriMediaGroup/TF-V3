// components/Header.js
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "../../styles/GlobalStyles";
import NotificationsDrawer from "../notifications/NotificationsDrawer";
import MenuModal from "./MenuModal";
import supabase from "../../supabase/client";
import { useAuth } from "../../auth/AuthContext";

export default function Header({ showBell = false, unreadCount, showMenu = true }) {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const { user } = useAuth();
  const [internalCount, setInternalCount] = useState(0);

  // Auto-load unread count if parent hasn't provided one
  useEffect(() => {
    if (!showBell) return;
    // If parent explicitly passes a number, don't auto-load
    if (typeof unreadCount === "number") return;
    if (!user?.id) return;

    let mounted = true;
    const fetchCount = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (!mounted) return;
      if (error) {
        console.error("unread count error:", error.message);
        setInternalCount(0);
      } else {
        setInternalCount(count || 0);
      }
    };
    fetchCount();

    const channel = supabase
      .channel("notif-count-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [showBell, unreadCount, user?.id]);

  const badgeCount = typeof unreadCount === "number" ? unreadCount : internalCount;

  return (
    <View style={styles.container}>
      <View style={styles.logoHolder}>
        <Image
          source={require("../../assets/images/TriggerFeed-white.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={[styles.logoText, { color: Colors.crimson }]}>TriggerFeed</Text>
      </View>

      <View style={styles.actionRow}>
        {showBell && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setDrawerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
          >
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {badgeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {showMenu && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <Ionicons name="menu" size={26} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {showBell && (
        <NotificationsDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          position="right"
        />
      )}

      {showMenu && (
        <MenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    backgroundColor: Colors.gunmetal,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 0,
    marginBottom: 0,
  },
  logoHolder: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoImage: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: Fonts.heading,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    position: "relative",
    padding: 6,
    marginLeft: 8,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: Colors.crimson,
    borderRadius: 8,
    paddingHorizontal: 4,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
});
