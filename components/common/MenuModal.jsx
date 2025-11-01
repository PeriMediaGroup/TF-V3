import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import SideDrawer from "./SideDrawer";
import { Colors } from "../../styles/GlobalStyles";
import { useTheme } from "../../styles/ThemeContext";

const MENU_ITEMS = [
  {
    key: "profile",
    label: "My Profile",
    navigateTo: { name: "Profile", params: { screen: "ProfileHome" } },
  },
  { key: "site", label: "TriggerFeed Website", url: "https://triggerfeed.com" },
  { key: "merch", label: "Merch Store", url: "https://triggerfeed.com/merch" },
  { key: "about", label: "About TriggerFeed", url: "https://triggerfeed.com/about" },
  { key: "contact", label: "Contact", url: "https://triggerfeed.com/contact" },
  { key: "coffee", label: "Buy us a round", url: "https://buymeacoffee.com/triggerfeed" },
  { key: "privacy", label: "Privacy!", url: "https://triggerfeed.com/privacy" },
];

export default function MenuModal({ visible, onClose }) {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const handlePress = async (item) => {
    if (item.navigateTo) {
      onClose?.();
      requestAnimationFrame(() => {
        navigation.navigate(item.navigateTo.name, item.navigateTo.params);
      });
      return;
    }

    if (!item.url) return;

    try {
      await Linking.openURL(item.url);
    } catch (e) {
      console.warn("[MenuModal] failed to open url", item.url, e?.message);
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
      {MENU_ITEMS.map((item, index) => {
        const isFirst = index === 0;
        const isNavigate = !!item.navigateTo;
        const textColor = isNavigate ? theme.text : Colors.crimson;
        const trailingIcon = isNavigate ? "chevron-forward" : "open-outline";

        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.linkRow, isFirst && styles.firstRow]}
            onPress={() => handlePress(item)}
            accessibilityRole={isNavigate ? "button" : "link"}
            activeOpacity={0.85}
          >
            <View style={styles.linkTextWrap}>
              <Text style={[styles.linkText, { color: textColor }]}>
                {item.label}
              </Text>
            </View>
            <Ionicons name={trailingIcon} size={18} color={theme.muted} />
          </TouchableOpacity>
        );
      })}
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
    paddingVertical: 12,
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
