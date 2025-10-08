// screens/LoginScreen.jsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { logIn } from "../supabase/helpers";
import { useNavigation } from "@react-navigation/native";
import { Colors } from "../styles/GlobalStyles";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigation = useNavigation();

  const handleLogin = async () => {
    const { success, error } = await logIn(email, password);
    if (success) {
      Alert.alert("Success", "Logged in!");
    } else {
      Alert.alert("Login failed", error || "Check your credentials");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.gunmetal }]}>
      <Text style={[styles.title, { color: Colors.crimson }]}>
        Login
      </Text>

      <TextInput
        style={[styles.input, { color: Colors.white }]}
        placeholder="Email"
        placeholderTextColor={Colors.gray}
        autoCapitalize="none"
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

      <Button title="Login" onPress={handleLogin} />

      {/* 👇 Add link to Sign Up */}
      <TouchableOpacity
        style={{ marginTop: 20 }}
        onPress={() => navigation.navigate("Signup")}
      >
        <Text style={{ color: Colors.gray }}>
          Don’t have an account? <Text style={{ color: Colors.crimson }}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "top", padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 12,
    borderRadius: 5,
  },
});
