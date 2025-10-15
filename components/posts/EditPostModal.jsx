import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

export default function EditPostModal({
  visible,
  onClose,
  initialTitle,
  initialDescription,
  onSave,
}) {
  const [title, setTitle] = useState(initialTitle || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle || "");
      setDescription(initialDescription || "");
      setSaving(false);
    }
  }, [visible, initialTitle, initialDescription]);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle && !trimmedDescription) {
      alert("Please enter a title or description.");
      return;
    }
    try {
      setSaving(true);
      await onSave?.({
        title: trimmedTitle,
        description: trimmedDescription,
      });
      onClose?.();
    } catch (err) {
      alert(err?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.heading}>Edit Post</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            style={styles.input}
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description"
            style={[styles.input, styles.textArea]}
            placeholderTextColor="#666"
            multiline
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSubmit}
              disabled={saving}
            >
              <Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: "#1f1f1f",
    borderRadius: 16,
    padding: 20,
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ddd",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#444",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    backgroundColor: "#2a2a2a",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 12,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#666",
  },
  cancelText: {
    color: "#ddd",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#B22222",
  },
  saveText: {
    color: "#fff",
    fontWeight: "700",
  },
});
