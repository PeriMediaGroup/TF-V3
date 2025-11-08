import { useState } from "react";
import {
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "../styles/ThemeContext";
import { useAuth } from "../auth/AuthContext";
import supabase from "../supabase/client";
import ScreenHeader from "../components/common/ScreenHeader";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InviteFriendScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-friend", {
        body: {
          email: trimmedEmail,
          inviterName:
            user?.user_metadata?.full_name ||
            user?.user_metadata?.display_name ||
            user?.email ||
            "A Triggerfeed friend",
          message: message.trim() || undefined,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        Alert.alert("Invite Sent", `We emailed ${trimmedEmail} with your invite.`);
        setEmail("");
        setMessage("");
      } else {
        Alert.alert("Invite Sent", `We attempted to email ${trimmedEmail}.`);
      }
    } catch (err) {
      console.error("Invite error", err);
      Alert.alert(
        "Unable to Send",
        err?.message || "We could not send that invite right now. Try again shortly."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title="Invite a Friend" />
        <Text style={[styles.title, { color: theme.text }]}>
          Invite a Friend
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted || "#888" }]}>
          Share Triggerfeed with someone you know. We will send them an email with
          your invite link.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="friend@example.com"
            placeholderTextColor={theme.textMuted || "#888"}
            style={[
              styles.input,
              {
                backgroundColor: theme.card || "#1f1f1f",
                color: theme.text,
                borderColor: theme.border || "#333",
              },
            ]}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>
            Personal Message (optional)
          </Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="Tell them why Triggerfeed is worth joining."
            placeholderTextColor={theme.textMuted || "#888"}
            style={[
              styles.textarea,
              {
                backgroundColor: theme.card || "#1f1f1f",
                color: theme.text,
                borderColor: theme.border || "#333",
              },
            ]}
          />
        </View>

        <Button
          title={loading ? "Sending…" : "Send Invite"}
          onPress={handleSubmit}
          disabled={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 120,
    fontSize: 16,
  },
});

