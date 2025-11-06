import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../styles/ThemeContext";
import { Colors, Fonts } from "../../styles/GlobalStyles";

const HIDDEN_ROUTES = new Set(["Profile"]);

export default function FooterTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const focusedOptions = descriptors[state.routes[state.index].key].options;

  const hideTabBar =
    focusedOptions.tabBarStyle && focusedOptions.tabBarStyle.display === "none";

  if (hideTabBar) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom || 0, 6),
        },
      ]}
    >
      {state.routes
        .filter((route) => !HIDDEN_ROUTES.has(route.name))
        .map((route) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          const routeIndex = state.routes.findIndex((entry) => entry.key === route.key);
          const isFocused = state.index === routeIndex;
          const tabBarLabelStyle = options.tabBarLabelStyle || {};

          const activeTint = options.tabBarActiveTintColor || Colors.white;
          const inactiveTint = options.tabBarInactiveTintColor || theme.textMuted;
          const color = isFocused ? activeTint : inactiveTint;

          const icon =
            typeof options.tabBarIcon === "function"
              ? options.tabBarIcon({ focused: isFocused, color, size: isFocused ? 24 : 22 })
              : null;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (event.defaultPrevented) {
              return;
            }

            if (!isFocused) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          const badge = options.tabBarBadge;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={[styles.tabButton, isFocused && styles.tabButtonActive]}
            activeOpacity={0.85}
          >
            <View style={styles.tabContent}>
              {icon}
              <Text style={[styles.label, { color }, tabBarLabelStyle]} numberOfLines={1}>
                {label}
              </Text>
              {badge != null && badge !== false && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {typeof badge === "string" ? badge : String(badge)}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.gunmetal,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  tabButtonActive: {
    backgroundColor: Colors.crimson,
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginLeft: 6,
    fontSize: 11,
    fontFamily: Fonts.body,
    color: Colors.white,
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 12,
    minWidth: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.crimson,
  },
});
