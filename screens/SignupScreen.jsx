import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Switch,
  TouchableOpacity,
  Linking,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import supabase from "../supabase/client";
import { Colors } from "../styles/GlobalStyles";
import TfButton from "../components/common/TfButton";
import debounce from "lodash.debounce";
import reservedUsernames from "../data/reservedUsernames";

export default function SignupScreen() {
  const navigation = useNavigation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);

  const isFormValid = email && password && username && agreed;
  const supportMailHandler = useCallback(() => {
    const sanitized = username || "TriggerFeed Username";
    const subject = encodeURIComponent(`Username Claim: ${sanitized}`);
    const body = encodeURIComponent(
      `Hey TriggerFeed team,\n\nI'd like to claim the username "${sanitized}".\nHere's why I believe it should belong to me:\n\n[Add your reasoning here]\n\nThanks!`
    );
    Linking.openURL(
      `mailto:support@triggerfeed.com?subject=${subject}&body=${body}`
    );
  }, [username]);

  const checkUsername = useCallback(async (candidate) => {
    if (!candidate) {
      setUsernameStatus(null);
      setUsernameSuggestions([]);
      return;
    }

    const lower = candidate.toLowerCase();
    if (reservedUsernames.includes(lower)) {
      setUsernameStatus("reserved");
      setUsernameSuggestions([]);
      return;
    }

    setUsernameStatus("checking");
    setUsernameSuggestions([]);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", candidate)
        .eq("is_deleted", false)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUsernameStatus("taken");
        const base = candidate.replace(/[^a-zA-Z0-9_]/g, "");
        const random = Math.floor(Math.random() * 999);
        const suffix = new Date().getFullYear().toString().slice(-2);
        setUsernameSuggestions([`${base}_tf`, `${base}${suffix}`, `${base}${random}`]);
      } else {
        setUsernameStatus("available");
        setUsernameSuggestions([]);
      }
    } catch (err) {
      console.error("Username check failed:", err.message);
      setUsernameStatus(null);
      setUsernameSuggestions([]);
    }
  }, []);

  const debouncedCheck = useMemo(() => debounce(checkUsername, 500), [checkUsername]);

  useEffect(() => {
    debouncedCheck(username);
    return () => debouncedCheck.cancel();
  }, [username, debouncedCheck]);

  useEffect(() => {
    if (email && !username) {
      const suggestion = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
      setUsername(suggestion);
    }
  }, [email, username]);

  const handleSignup = async () => {
    if (!isFormValid) {
      Alert.alert("Missing Info", "Fill all fields and accept T&C.");
      return;
    }

    // ✅ Check reserved usernames
    if (reservedUsernames.includes(username.toLowerCase())) {
      Alert.alert("Username not allowed", "Please choose another.");
      return;
    }

    setLoading(true);

    try {
      // ✅ Check if username already exists in profiles
      const { data: existing, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .eq("is_deleted", false)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing) {
        Alert.alert("Username taken", "Please choose another username.");
        setLoading(false);
        return;
      }

      // ✅ Create user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      const user = data?.user;
      if (user) {
        // ✅ Update profile with chosen username
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ username })
          .eq("id", user.id)
          .eq("is_deleted", false);

        if (updateError) throw updateError;
      }

      Alert.alert(
        "Signup successful",
        "Check your email to confirm your account before logging in."
      );
      navigation.navigate("Login");
    } catch (err) {
      console.error("Signup error:", err);
      Alert.alert("Signup failed", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.gunmetal }]}>
      <Text style={[styles.title, { color: Colors.crimson }]}>Join TriggerFeed</Text>

      <TextInput
        style={[styles.input, { color: Colors.white }]}
        placeholder="Username"
        placeholderTextColor={Colors.gray}
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <View style={styles.usernameStatusContainer}>
        {usernameStatus === "checking" && (
          <Text style={[styles.statusText, { color: Colors.gray }]}>Checking...</Text>
        )}

        {usernameStatus === "available" && (
          <Text style={[styles.statusText, { color: "limegreen" }]}>✅ Available</Text>
        )}

        {usernameStatus === "taken" && (
          <View style={styles.statusBlock}>
            <Text style={[styles.statusText, { color: Colors.crimson }]}>
              ❌ Taken —{" "}
              <Text style={styles.mailtoLink} onPress={supportMailHandler}>
                let us know
              </Text>{" "}
              if you should own it.
            </Text>
            {usernameSuggestions.length > 0 && (
              <View style={styles.suggestionList}>
                {usernameSuggestions.map((sug) => (
                  <TouchableOpacity
                    key={sug}
                    style={styles.suggestionPill}
                    onPress={() => setUsername(sug)}
                  >
                    <Text style={{ color: Colors.white }}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {usernameStatus === "reserved" && (
          <Text style={[styles.statusText, { color: "gold" }]}>
            ⚠ Reserved name —{" "}
            <Text style={styles.mailtoLink} onPress={supportMailHandler}>
              contact support@triggerfeed.com
            </Text>
          </Text>
        )}
      </View>

      <TextInput
        style={[styles.input, { color: Colors.white }]}
        placeholder="Email"
        placeholderTextColor={Colors.gray}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={[styles.input, { color: Colors.white }]}
        placeholder="Password"
        placeholderTextColor={Colors.gray}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.row}>
        <Text style={[styles.label, { color: Colors.white }]}>
          I am 18+ and agree to{" "}
          <Text
            style={{ color: Colors.crimson, textDecorationLine: "underline" }}
            onPress={() => navigation.navigate("Terms")}
          >
            Terms & Conditions
          </Text>
        </Text>
        <Switch
          value={agreed}
          onValueChange={setAgreed}
          trackColor={{ true: Colors.gray, false: Colors.gray }}
          thumbColor={agreed ? Colors.crimson : Colors.white}
        />
      </View>

      <TfButton
        label={loading ? "Creating Account..." : "Sign Up"}
        onPress={handleSignup}
        disabled={!isFormValid || loading}
        loading={loading}
        style={styles.primaryButton}
      />

      <TouchableOpacity
        style={{ marginTop: 20 }}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={{ color: Colors.gray }}>
          Already have an account?{" "}
          <Text style={{ color: Colors.crimson }}>Log In</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 12,
    borderRadius: 5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  label: { fontSize: 14, flex: 1, marginRight: 10 },
  primaryButton: {
    marginTop: 8,
  },
  usernameStatusContainer: {
    minHeight: 48,
    marginBottom: 12,
    justifyContent: "center",
  },
  statusText: {
    fontSize: 13,
  },
  suggestionList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  suggestionPill: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  statusBlock: {
    marginTop: 6,
  },
  mailtoLink: {
    color: "#ffcc00",
    textDecorationLine: "underline",
  },
});
