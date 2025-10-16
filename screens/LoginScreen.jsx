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
import { useNavigation } from "@react-navigation/native";
import { logIn } from "../supabase/helpers";
import { Colors } from "../styles/GlobalStyles";
import ForgotPassword from "../components/auth/ForgotPassword";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);
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
      {showForgot ? (
        <ForgotPassword
          initialEmail={email}
          onClose={() => setShowForgot(false)}
        />
      ) : (
        <>
          <Text style={[styles.title, { color: Colors.crimson }]}>Login</Text>

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

          <Button title="Login" onPress={handleLogin} />

          <TouchableOpacity
            style={{ marginTop: 16 }}
            onPress={() => setShowForgot(true)}
          >
            <Text style={{ color: Colors.gray }}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 20 }}
            onPress={() => navigation.navigate("Signup")}
          >
            <Text style={{ color: Colors.gray }}>
              {"Don't have an account? "}
              <Text style={{ color: Colors.crimson }}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 24, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
});
