import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  Switch,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import supabase from "../supabase/client";
import { Colors } from "../styles/GlobalStyles";

// Reserved usernames (can later pull from DB if needed)
const reservedUsernames = [
  "admin",
  "ceo",
  "triggerfeed",
  "tf-one",
  "support",
  "moderator",
  "sig",
  "sigsauer",
  "sig_sauer",
];

export default function SignupScreen() {
  const navigation = useNavigation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const isFormValid = email && password && username && agreed;

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
      <Text style={[styles.title, { color: Colors.crimson }]}>Create Account</Text>

      <TextInput
        style={[styles.input, { color: Colors.white }]}
        placeholder="Username"
        placeholderTextColor={Colors.gray}
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />

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

      <Button
        title={loading ? "Creating Account..." : "Sign Up"}
        onPress={handleSignup}
        disabled={!isFormValid || loading}
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
});
