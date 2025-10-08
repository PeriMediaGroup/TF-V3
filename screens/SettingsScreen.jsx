import React, { useState } from "react";
import { View, Text, Switch, StyleSheet, TextInput, Alert } from "react-native";
import { useTheme } from "../styles/ThemeContext";
import { Colors } from "../styles/GlobalStyles";
import { Button } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { sendInviteEmail } from "../utils/inviteFriend";

export default function SettingsScreen({ navigation }) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { isElevated, user } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      Alert.alert("Missing email", "Please enter an email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (!user?.id) {
      Alert.alert("Not signed in", "You must be signed in to send invites.");
      return;
    }

    try {
      setInviteLoading(true);
      const result = await sendInviteEmail(email, user);
      if (result?.success) {
        Alert.alert("Invite sent", `Invitation sent to ${email}.`);
        setInviteEmail("");
      } else {
        Alert.alert("Invite failed", result?.error || "Could not send invite. Try again later.");
      }
    } catch (err) {
      Alert.alert("Invite failed", err?.message || "Unexpected error.");
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.text }]}>
          Dark Mode
        </Text>
        <Switch
          value={isDark}
          onValueChange={toggleTheme}
          trackColor={{ true: Colors.crimson, false: Colors.gray }}
          thumbColor={isDark ? Colors.white : Colors.gunmetal}
        />
      </View>
      {isElevated && (
        <View style={{ marginTop: 12 }}>
          <Button title="Admin Dashboard" onPress={() => navigation.navigate('AdminDashboard')} />
        </View>
      )}

      <View
        style={[
          styles.inviteSection,
          {
            borderColor: theme.border,
            backgroundColor: theme.card,
          },
        ]}
      >
        <Text style={[styles.inviteTitle, { color: theme.text }]}>Invite a Friend</Text>
        <TextInput
          placeholder="Enter email address"
          placeholderTextColor={theme.muted}
          value={inviteEmail}
          onChangeText={setInviteEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[
            styles.inviteInput,
            {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
        />
        <Button
          title={inviteLoading ? "Sending..." : "Send Invite"}
          color={Colors.crimson}
          onPress={handleInvite}
          disabled={inviteLoading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  label: { fontSize: 16 },
  inviteSection: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
  },
  inviteTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  inviteInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
});
