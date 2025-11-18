import React, { useCallback } from "react";
import { TouchableOpacity, StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../styles/ThemeContext";

export default function CreatePostFab({ onPress, style }) {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const handlePress = useCallback(() => {
    if (typeof onPress === "function") {
      onPress();
      return;
    }
    const parentNavigator = navigation.getParent?.();
    if (parentNavigator?.navigate) {
      parentNavigator.navigate("Create");
      return;
    }
    navigation.navigate("Create");
  }, [navigation, onPress]);

  return (
    <TouchableOpacity
      style={[styles.fab, { backgroundColor: theme.primary }, style]}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Create a new post"
    >
      <Text style={styles.icon}>+</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 20,
    borderColor: "#5c5858ff",
    borderWidth: 2,
  },
  icon: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
  },
});
