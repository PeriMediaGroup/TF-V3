import { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../auth/AuthContext";
import supabase from "../supabase/client";
import { useTheme } from "../styles/ThemeContext";
import FriendSearchInput from "../components/common/FriendSearchInput";

export default function EditProfileScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // load profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "username, about, first_name, last_name, city, state, rank, top_guns, top_friends"
          )
          .eq("id", user.id)
          .single();
        if (error) throw error;
        setProfile(data);
      } catch (err) {
        Alert.alert("Error", err.message);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(profile)
        .eq("id", user.id);
      if (error) throw error;
      Alert.alert("Success", "Profile updated!");
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error saving profile", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" style={[styles.label, { color: theme.primary }]}/>
      </View>
    );
  }

  // define fields for FlatList rendering
  const fields = [
    { key: "username", label: "Username", type: "input" },
    { key: "first_name", label: "First Name", type: "input" },
    { key: "last_name", label: "Last Name", type: "input" },
    { key: "city", label: "City", type: "input" },
    { key: "state", label: "State", type: "picker" },
    { key: "about", label: "About", type: "textarea" },
    ...Array.from({ length: 5 }, (_, i) => ({
      key: `gun-${i}`,
      label: `Gun ${i + 1}`,
      type: "gun",
      index: i,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      key: `friend-${i}`,
      label: `Friend ${i + 1}`,
      type: "friend",
      index: i,
    })),
    { key: "save", type: "button" },
  ];

  const renderField = ({ item }) => {
    if (item.type === "input" || item.type === "textarea") {
      return (
        <View style={styles.fieldWrap}>
          <Text style={[styles.label, { color: theme.text }]}>
            {item.label}
          </Text>
          <TextInput
            style={[
              styles.input,
              item.type === "textarea" && styles.textArea,
              { color: theme.text },
            ]}
            placeholder={item.label}
            placeholderTextColor={theme.mutedText || "#999"}
            value={profile[item.key] || ""}
            onChangeText={(text) =>
              setProfile({ ...profile, [item.key]: text })
            }
            multiline={item.type === "textarea"}
          />
        </View>
      );
    }
    if (item.type === "picker") {
      return (
        <View style={styles.fieldWrap}>
          <Text style={[styles.label, { color: theme.text }]}>
            {item.label}
          </Text>
          <Picker
            selectedValue={profile.state || ""}
            onValueChange={(value) => setProfile({ ...profile, state: value })}
            style={[styles.picker, { color: theme.text }]}
          >
            <Picker.Item label="Select a state" value="" />
            <Picker.Item label="Alabama" value="AL" />
            <Picker.Item label="Alaska" value="AK" />
            <Picker.Item label="Arizona" value="AZ" />
            <Picker.Item label="Arkansas" value="AR" />
            <Picker.Item label="California" value="CA" />
            <Picker.Item label="Colorado" value="CO" />
            <Picker.Item label="Connecticut" value="CT" />
            <Picker.Item label="Delaware" value="DE" />
            <Picker.Item label="Florida" value="FL" />
            <Picker.Item label="Georgia" value="GA" />
            <Picker.Item label="Hawaii" value="HI" />
            <Picker.Item label="Idaho" value="ID" />
            <Picker.Item label="Illinois" value="IL" />
            <Picker.Item label="Indiana" value="IN" />
            <Picker.Item label="Iowa" value="IA" />
            <Picker.Item label="Kansas" value="KS" />
            <Picker.Item label="Kentucky" value="KY" />
            <Picker.Item label="Louisiana" value="LA" />
            <Picker.Item label="Maine" value="ME" />
            <Picker.Item label="Maryland" value="MD" />
            <Picker.Item label="Massachusetts" value="MA" />
            <Picker.Item label="Michigan" value="MI" />
            <Picker.Item label="Minnesota" value="MN" />
            <Picker.Item label="Mississippi" value="MS" />
            <Picker.Item label="Missouri" value="MO" />
            <Picker.Item label="Montana" value="MT" />
            <Picker.Item label="Nebraska" value="NE" />
            <Picker.Item label="Nevada" value="NV" />
            <Picker.Item label="New Hampshire" value="NH" />
            <Picker.Item label="New Jersey" value="NJ" />
            <Picker.Item label="New Mexico" value="NM" />
            <Picker.Item label="New York" value="NY" />
            <Picker.Item label="North Carolina" value="NC" />
            <Picker.Item label="North Dakota" value="ND" />
            <Picker.Item label="Ohio" value="OH" />
            <Picker.Item label="Oklahoma" value="OK" />
            <Picker.Item label="Oregon" value="OR" />
            <Picker.Item label="Pennsylvania" value="PA" />
            <Picker.Item label="Rhode Island" value="RI" />
            <Picker.Item label="South Carolina" value="SC" />
            <Picker.Item label="South Dakota" value="SD" />
            <Picker.Item label="Tennessee" value="TN" />
            <Picker.Item label="Texas" value="TX" />
            <Picker.Item label="Utah" value="UT" />
            <Picker.Item label="Vermont" value="VT" />
            <Picker.Item label="Virginia" value="VA" />
            <Picker.Item label="Washington" value="WA" />
            <Picker.Item label="West Virginia" value="WV" />
            <Picker.Item label="Wisconsin" value="WI" />
            <Picker.Item label="Wyoming" value="WY" />
            <Picker.Item label="Other" value="Other" />
          </Picker>
        </View>
      );
    }
    if (item.type === "gun") {
      return (
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.text }]}>
            {item.label}
          </Text>
          <TextInput
            style={[styles.input, { flex: 1, color: theme.text }]}
            placeholder={item.label}
            placeholderTextColor={theme.mutedText || "#999"}
            value={profile.top_guns?.[item.index] || ""}
            onChangeText={(text) => {
              const updated = [...(profile.top_guns || [])];
              updated[item.index] = text;
              setProfile({ ...profile, top_guns: updated });
            }}
          />
        </View>
      );
    }
    if (item.type === "friend") {
      return (
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.text }]}>
            {item.label}
          </Text>

          <View style={{ flex: 1 }}>
            <FriendSearchInput
              placeholder={item.label}
              value={profile.top_friends?.[item.index] || ""}
              onChange={(username) => {
                const updated = [...(profile.top_friends || [])];
                updated[item.index] = username;
                setProfile({ ...profile, top_friends: updated });
              }}
            />
          </View>
        </View>
      );
    }
    if (item.type === "button") {
      return (
        <Button
          title={saving ? "Saving..." : "Save"}
          onPress={handleSave}
          disabled={saving}
        />
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <FlatList
        data={fields}
        renderItem={renderField}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[
          styles.container,
          { backgroundColor: theme.background, paddingBottom: 50 },
        ]}
        keyboardShouldPersistTaps="handled"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  fieldWrap: { marginBottom: 12 },
  label: { marginBottom: 6, fontWeight: "600", marginRight: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
  },
  textArea: { height: 100, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  index: { width: 22, textAlign: "right", marginRight: 6 },
  picker: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
  },
});
