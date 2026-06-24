import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../styles/ThemeContext";
import { Colors } from "../../styles/GlobalStyles";

const defaultTheme = {
  primary: Colors.crimson,
  shadow: "#000",
  card: Colors.gunmetal,
  text: Colors.white,
};

const TfButton = ({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon = null,
  style,
  textStyle,
  fullWidth = true,
}) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || defaultTheme;
  const isDisabled = disabled || loading;

  const buttonStyles = [
    styles.button,
    fullWidth && styles["button--full"],
    { backgroundColor: theme.primary, shadowColor: theme.shadow || "#000" },
  ];

  const labelStyles = [styles["button__label"]];

  if (variant === "outline") {
    buttonStyles.push(styles["button--outline"], { borderColor: theme.primary });
    labelStyles.push(styles["button__label--outline"], { color: theme.primary });
  }

  if (variant === "danger") {
    buttonStyles.push(styles["button--danger"]);
  }

  if (variant === "ghost") {
    buttonStyles.push(styles["button--ghost"]);
    labelStyles.push(styles["button__label--ghost"]);
  }

  if (isDisabled) {
    buttonStyles.push(styles["button--disabled"]);
  }

  const indicatorColor =
    variant === "outline" || variant === "ghost" ? theme.primary : Colors.white;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[...buttonStyles, style]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={indicatorColor} />
      ) : (
        <View style={styles["button__content"]}>
          {icon ? <View style={styles["button__icon"]}>{icon}</View> : null}
          <Text style={[...labelStyles, textStyle]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default TfButton;

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: "row",
    borderWidth: 0,
  },
  "button--full": {
    alignSelf: "stretch",
  },
  "button--outline": {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  "button--ghost": {
    backgroundColor: "transparent",
    elevation: 0,
    shadowOpacity: 0,
  },
  "button--danger": {
    backgroundColor: "#7A1818",
  },
  "button--disabled": {
    opacity: 0.6,
  },
  "button__content": {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  "button__icon": {
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  "button__label": {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  "button__label--outline": {
    color: Colors.white,
  },
  "button__label--ghost": {
    color: Colors.white,
  },
});
