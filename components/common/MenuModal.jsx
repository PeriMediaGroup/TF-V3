import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";


import SideDrawer from "./SideDrawer";
import { Colors } from "../../styles/GlobalStyles";
import { useTheme } from "../../styles/ThemeContext";

const MENU_LINKS = [
  { label: "TriggerFeed Website", url: "https://triggerfeed.com" },
  { label: "Merch Store", url: "https://triggerfeed.com/merch" },
  { label: "About TriggerFeed", url: "https://triggerfeed.com/about" },
  { label: "Contact", url: "https://triggerfeed.com/contact" },
  { label: "Buy us a round", url: "https://buymeacoffee.com/triggerfeed" },
  { label: "Privacy!", url: "https://triggerfeed.com/privacy" },
];

export default function MenuModal({ visible, onClose }) {
  const { theme } = useTheme();

  const handlePress = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.warn("[MenuModal] failed to open url", url, e?.message);
    } finally {
      onClose?.();
    }
  };

  return (
    <SideDrawer
      visible={visible}
      onClose={onClose}
      title="Explore TriggerFeed"
      contentStyle={styles.content}
    >
      {MENU_LINKS.map((item, index) => (
        <TouchableOpacity
          key={item.url}
          style={[styles.linkRow, index === 0 && styles.firstRow]}
          onPress={() => handlePress(item.url)}
          accessibilityRole="link"
          activeOpacity={0.85}
        >
          <View style={styles.linkTextWrap}>
            <Text style={[styles.linkText, { color: Colors.crimson }]}>{item.label}</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={theme.muted} />
        </TouchableOpacity>
      ))}
    </SideDrawer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  firstRow: {
    borderTopWidth: 0,
  },
  linkTextWrap: {
    flexShrink: 1,
    paddingRight: 12,
  },
  linkText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
