// App.js
import { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as ScreenOrientation from "expo-screen-orientation";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import AppNavigator from "./navigation/AppNavigator";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ThemeProvider, useTheme } from "./styles/ThemeContext";
import Header from "./components/common/Header";

// import the defensive Supabase client helpers
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./supabase/client";

/**
 * StartupGuard UI
 * Shows when Supabase (or other critical runtime config) is missing.
 */
function StartupGuard({ onContinue }) {
  const missingUrl = !SUPABASE_URL;
  const missingKey = !SUPABASE_ANON_KEY;

  const openMail = () => {
    const subject = encodeURIComponent("TriggerFeed app: missing runtime configuration");
    const body = encodeURIComponent(
      `Hi team,\n\nThe app was launched but missing runtime config. Please check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY for this build.\n\nDevice: ${Platform.OS}\n\nThanks.`
    );
    Linking.openURL(`mailto:abuse@triggerfeed.com?subject=${subject}&body=${body}`).catch((err) => {
      if (__DEV__) {
        console.warn("[StartupGuard] mailto failed", err?.message || err);
      }
    });
  };

  return (
    <SafeAreaView style={styles.guardContainer}>
      <ScrollView contentContainerStyle={styles.guardInner}>
        <Text style={styles.guardTitle}>App configuration error</Text>
        <Text style={styles.guardSubtitle}>
          The app couldn't find required runtime configuration. This build is missing critical keys and
          cannot fully function.
        </Text>

        <View style={styles.keyBox}>
          <Text style={styles.keyHeader}>Runtime check</Text>
          <View style={styles.keyRow}>
            <Text style={styles.keyName}>EXPO_PUBLIC_SUPABASE_URL</Text>
            <Text style={[styles.keyValue, missingUrl ? styles.missing : styles.present]}>
              {missingUrl ? "missing" : "present"}
            </Text>
          </View>
          <View style={styles.keyRow}>
            <Text style={styles.keyName}>EXPO_PUBLIC_SUPABASE_ANON_KEY</Text>
            <Text style={[styles.keyValue, missingKey ? styles.missing : styles.present]}>
              {missingKey ? "missing" : "present"}
            </Text>
          </View>
        </View>

        <Text style={styles.howToFix}>
          How to fix: ensure these values are provided at build time via EAS/Expo build environment or
          embedded in <Text style={styles.code}>app.config.js</Text> under <Text style={styles.code}>extra</Text>.
        </Text>

        <TouchableOpacity style={styles.button} onPress={openMail}>
          <Text style={styles.buttonText}>Email admin (abuse@triggerfeed.com)</Text>
        </TouchableOpacity>

        {__DEV__ && (
          <>
            <Text style={styles.devHint}>
              Developer shortcut: proceed into the app (dev only). This bypass is visible only in debug
              builds.
            </Text>
            <TouchableOpacity style={[styles.button, styles.ghost]} onPress={onContinue}>
              <Text style={[styles.buttonText, styles.ghostText]}>Continue (dev only)</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * RootLayout, unchanged except used conditionally after the guard passes.
 */
function RootLayout({ currentRouteName }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const hideChrome = currentRouteName === "VideoRecorder" || currentRouteName === "Menu";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {!hideChrome && <Header showBell={!!user} />}
      <AppNavigator />
    </SafeAreaView>
  );
}

/**
 * Main App
 * If supabase is not configured, show the guard UI; otherwise boot the app normally.
 */
export default function App() {
  const navRef = useNavigationContainerRef();
  const [currentRouteName, setCurrentRouteName] = useState();
  // allow manual bypass in dev builds (so you can iterate without a rebuild)
  const [devBypass, setDevBypass] = useState(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).catch((err) => {
      if (__DEV__) console.warn("[Orientation] lock failed", err?.message || err);
    });
  }, []);

  const handleNavState = () => {
    const route = navRef.getCurrentRoute();
    if (route?.name !== currentRouteName) {
      setCurrentRouteName(route?.name);
    }
  };

  // safe check - handles both stubbed supabase and real client
  const isConfigured = isSupabaseConfigured();

  // If not configured and not bypassed, show the guard screen.
  if (!isConfigured && !devBypass) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            {/* minimal providers so guard styling and theme works */}
            <StartupGuard onContinue={() => setDevBypass(true)} />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // Normal app startup
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NavigationContainer ref={navRef} onReady={handleNavState} onStateChange={handleNavState}>
              <RootLayout currentRouteName={currentRouteName} />
            </NavigationContainer>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  guardContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  guardInner: {
    padding: 20,
    alignItems: "stretch",
  },
  guardTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  guardSubtitle: {
    fontSize: 14,
    marginBottom: 12,
    color: "#444",
  },
  keyBox: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  keyHeader: {
    fontWeight: "700",
    marginBottom: 8,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  keyName: {
    color: "#222",
  },
  keyValue: {
    fontWeight: "700",
  },
  missing: {
    color: "#c0392b",
  },
  present: {
    color: "#16a34a",
  },
  howToFix: {
    fontSize: 13,
    color: "#333",
    marginBottom: 12,
  },
  code: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    backgroundColor: "#eef2ff",
    paddingHorizontal: 4,
  },
  button: {
    backgroundColor: "#0b74de",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  devHint: {
    marginTop: 6,
    marginBottom: 6,
    color: "#666",
    fontSize: 12,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#888",
  },
  ghostText: {
    color: "#222",
  },
});
