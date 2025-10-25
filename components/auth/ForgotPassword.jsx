import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import supabase from "../../supabase/client";
import { Colors } from "../../styles/GlobalStyles";

const REDIRECT_URL = "https://triggerfeed.com/reset";

export default function ForgotPassword({ initialEmail = "", onClose }) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert("Enter email", "Please enter the email tied to your account.");
      return;
    }

    try {
      setSending(true);
      setSuccessMessage("");
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: REDIRECT_URL,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage("Check your inbox for the reset link.");
    } catch (err) {
      Alert.alert("Reset failed", err.message || "Unable to send reset email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: Colors.crimson }]}>
        Reset Password
      </Text>
      <Text style={[styles.helperText, { color: Colors.gray }]}>
        Enter your account email and we'll send you a reset link.
      </Text>
      <TextInput
        style={[styles.input, { color: Colors.white }]}
        placeholder="Email"
        placeholderTextColor={Colors.gray}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          { backgroundColor: sending ? Colors.gray : Colors.crimson },
        ]}
        onPress={handleReset}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.primaryBtnText}>Send Reset Link</Text>
        )}
      </TouchableOpacity>

      {successMessage ? (
        <Text style={[styles.successText, { color: Colors.white }]}>
          {successMessage}
        </Text>
      ) : null}

      <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
        <Text style={{ color: Colors.gray }}>Back to login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", gap: 16 },
  title: { fontSize: 24, textAlign: "center" },
  helperText: { textAlign: "center", fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 6,
  },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  primaryBtnText: { color: Colors.white, fontWeight: "700" },
  successText: { textAlign: "center", marginTop: 4 },
  secondaryBtn: { alignItems: "center" },
});
