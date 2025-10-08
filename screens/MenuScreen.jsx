import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import MenuModal from "../components/common/MenuModal";
import { useTheme } from "../styles/ThemeContext";

export default function MenuScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => setVisible(false);
    }, [])
  );

  const closeMenu = () => {
    setVisible(false);
    requestAnimationFrame(() => {
      navigation.navigate("Feed");
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <MenuModal visible={visible} onClose={closeMenu} />
    </View>
  );
}
