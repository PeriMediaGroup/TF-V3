import React, { useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../styles/ThemeContext";
import { Colors } from "../styles/GlobalStyles";
import { Button } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { sendInviteEmail } from "../utils/inviteFriend";
import supabase from "../supabase/client";
import { showToast } from "../utils/toast";

export default function SettingsScreen({ navigation }) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { isElevated, user, logOut } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleConfirmDelete = async () => {
    if (deleteLoading) return;
    setDeleteLoading(true);
    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("delete_user_account", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      if (error) {
        throw new Error(error.message || "Unable to delete account.");
      }
      if (!data?.success) {
        throw new Error(data?.error || "Delete account request failed.");
      }
      setDeleteModalVisible(false);
      showToast("Your account has been deleted.");
      await logOut();
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (err) {
      console.error("delete_user_account failed:", err?.message || err);
      Alert.alert("Delete failed", err?.message || "Unable to delete account right now.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIcon}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Settings
          </Text>
          <View style={styles.headerSpacer} />
        </View>

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

        <View
          style={[
            styles.dangerSection,
            {
              borderColor: theme.border,
              backgroundColor: theme.card,
            },
          ]}
        >
          <Text style={[styles.inviteTitle, { color: theme.text }]}>
            Account
          </Text>
          <Text style={[styles.dangerCopy, { color: theme.muted }]}>
            Deleting your account will anonymize your profile. Posts will remain and show "Deleted User".
          </Text>
          <Button
            title="Delete Account"
            color={Colors.crimson}
            onPress={() => setDeleteModalVisible(true)}
          />
        </View>
      </ScrollView>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleteLoading) setDeleteModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Delete Account?
            </Text>
            <Text style={[styles.modalBody, { color: theme.text }]}>
              If you choose to delete your account, your personal information will be removed, and your posts will appear under "Deleted User".
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleteLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirm]}
                onPress={handleConfirmDelete}
                disabled={deleteLoading}
              >
                <Text style={styles.modalConfirmText}>
                  {deleteLoading ? "Deleting..." : "Confirm Deletion"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIcon: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 24,
  },
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
  dangerSection: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dangerCopy: {
    fontSize: 14,
    marginBottom: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    borderRadius: 12,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#444",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    columnGap: 12,
  },
  modalButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCancel: {
    backgroundColor: "#333",
  },
  modalConfirm: {
    backgroundColor: Colors.crimson,
  },
  modalCancelText: {
    color: "#fff",
    fontWeight: "600",
  },
  modalConfirmText: {
    color: "#fff",
    fontWeight: "700",
  },
});
