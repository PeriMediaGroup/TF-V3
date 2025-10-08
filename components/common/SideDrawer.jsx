import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Fonts } from "../../styles/GlobalStyles";

const { width: initialWidth } = Dimensions.get("window");

export default function SideDrawer({
  visible,
  onClose,
  title,
  actions = [],
  children,
  widthRatio = 0.8,
  backgroundColor = Colors.gunmetal,
  style,
  contentStyle,
  showClose = true,
  closeIconColor = Colors.white,
  testID,
  overlayColor = "rgba(0,0,0,0.5)",
  showShadow = true,
}) {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const drawerWidth = Math.min(initialWidth * widthRatio, initialWidth * 0.9);
  const slideAnim = useRef(new Animated.Value(drawerWidth)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      slideAnim.setValue(drawerWidth);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      Animated.timing(slideAnim, {
        toValue: drawerWidth,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setRendered(false);
        }
      });
    }
  }, [visible, rendered, drawerWidth, slideAnim]);

  if (!rendered) {
    return null;
  }

  return (
    <Modal transparent visible={rendered} animationType="none" onRequestClose={onClose}>
      <View style={styles.wrapper} testID={testID}>
        <Pressable style={[styles.backdrop, { backgroundColor: overlayColor }]} onPress={onClose} />
        <Animated.View
          style={[
            styles.drawer,
            !showShadow && styles.drawerNoShadow,
            {
              width: drawerWidth,
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateX: slideAnim }],
              backgroundColor,
            },
            style,
          ]}
        >
          {(title || showClose || actions.length > 0) && (
            <View style={styles.header}>
              {title ? <Text style={styles.title}>{title}</Text> : <View />}
              <View style={styles.headerActions}>
                {actions.map((action) => (
                  <TouchableOpacity
                    key={action.key || action.label}
                    style={[
                      styles.actionButton,
                      action.variant === "solid" ? styles.actionSolid : styles.actionSubtle,
                      action.style,
                    ]}
                    onPress={() => {
                      action.onPress?.();
                      if (action.autoClose) {
                        onClose?.();
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        action.variant === "solid" && styles.actionTextSolid,
                        action.textStyle,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                {showClose && (
                  <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close drawer">
                    <Ionicons name="close" size={24} color={closeIconColor} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          <View style={[styles.content, contentStyle]}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    position: "relative",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    height: "100%",
    marginLeft: "auto",
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 24,
  },
  drawerNoShadow: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    color: Colors.white,
    fontSize: 22,
    fontFamily: Fonts.heading,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  actionSubtle: {
    backgroundColor: "#3a4347",
  },
  actionSolid: {
    backgroundColor: Colors.crimson,
  },
  actionText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  actionTextSolid: {
    color: Colors.white,
  },
  closeButton: {
    padding: 6,
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
});
