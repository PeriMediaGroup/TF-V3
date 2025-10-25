import { View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import FeedScreen from "../screens/FeedScreen";
import CreatePostScreen from "../screens/CreatePostScreen";
import ProfileScreen from "../screens/ProfileScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import PublicProfileScreen from "../screens/PublicProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import InviteFriendScreen from "../screens/InviteFriendScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import SinglePostScreen from "../screens/SinglePostScreen";
import TaggedFeedScreen from "../screens/TaggedFeedScreen";
import VideoRecorderScreen from "../screens/VideoRecorderScreen";
import TermsScreen from "../screens/TermsScreen";
import AdminDashboardScreen from "../screens/AdminDashboard";
import FooterTabBar from "../components/ui/FooterTabBar";
import CameraCaptureScreen from "../screens/CameraCaptureScreen";

import { useTheme } from "../styles/ThemeContext";
import { Colors, Fonts } from "../styles/GlobalStyles";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function FeedStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.primary,
      }}
    >
      <Stack.Screen name="FeedHome" component={FeedScreen} />
      <Stack.Screen name="SinglePost" component={SinglePostScreen} />
      <Stack.Screen name="TaggedFeed" component={TaggedFeedScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.background,
          height: 56, // keeps it compact
          headerTopInsetEnabled: false,
          elevation: 0, // removes Android shadow
          shadowOpacity: 0, // removes iOS shadow
        },
        headerTintColor: theme.primary,
        headerTitleStyle: {
          color: theme.text,
          fontFamily: Fonts.heading,
          fontSize: 20,
          paddingTop: 0,
          marginTop: 0,
        },
        headerBackTitleVisible: false,
      }
      }
    >
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="InviteFriend"
        component={InviteFriendScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function CreateStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CreateHome" component={CreatePostScreen} />
      <Stack.Screen name="VideoRecorder" component={VideoRecorderScreen} />
      <Stack.Screen name="CameraCapture" component={CameraCaptureScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const focusedRoute = getFocusedRouteNameFromRoute(route) ?? "CreateHome";
        const hideTabBar =
          route.name === "Create" &&
          (focusedRoute === "VideoRecorder" || focusedRoute === "CameraCapture");
        return {
          headerShown: false,
          tabBarStyle: hideTabBar ? { display: "none" } : undefined,
          tabBarActiveTintColor: Colors.white,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarLabelStyle: { fontFamily: Fonts.body, fontSize: 12 },
          tabBarHideOnKeyboard: true,
        };
      }}
      tabBar={(props) => <FooterTabBar {...props} />}
    >
      <Tab.Screen
        name="Feed"
        component={FeedStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function MainLayout() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <MainTabs />
    </View>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainLayout} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}
