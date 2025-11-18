import { View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

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
import CameraCaptureScreen from "../screens/CameraCaptureScreen";

import { useTheme } from "../styles/ThemeContext";
import { Fonts } from "../styles/GlobalStyles";

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
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CreateHome" component={CreatePostScreen} />
      <Stack.Screen name="VideoRecorder" component={VideoRecorderScreen} />
      <Stack.Screen name="CameraCapture" component={CameraCaptureScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function MainTabs() {

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
      tabBar={() => null}
    >
      <Tab.Screen
        name="Feed"
        component={FeedStack}
      />
      <Tab.Screen
        name="Create"
        component={CreateStack}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
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
