import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Colors } from '../../styles/GlobalStyles';

const CATEGORIES = ['Offensive', 'Misinformation', 'Spam', 'Harassment', 'Other'];

export default function FlagPostModal({ visible, onCancel, onSubmit }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [details, setDetails] = useState('');

  const handleSubmit = () => {
    const reason = details.trim() ? `${category}: ${details.trim()}` : category;
    onSubmit?.(reason);
    setDetails('');
    setCategory(CATEGORIES[0]);
  };

  const handleCancel = () => {
    setDetails('');
    setCategory(CATEGORIES[0]);
    onCancel?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Report post</Text>
          <View style={{ marginBottom: 8 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c} style={styles.row} onPress={() => setCategory(c)}>
                <View style={[styles.radio, category === c && styles.radioOn]} />
                <Text style={styles.text}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            placeholder="Details (optional)"
            placeholderTextColor="#999"
            style={styles.input}
            value={details}
            onChangeText={setDetails}
            multiline
          />
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleCancel} style={[styles.btn, styles.cancel]}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} style={[styles.btn, styles.submit]}>
              <Text style={styles.btnText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '90%', backgroundColor: Colors.gunmetal, padding: 16, borderRadius: 10 },
  title: { color: Colors.white, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  radio: { width: 16, height: 16, borderRadius: 8, marginRight: 8, backgroundColor: '#555' },
  radioOn: { backgroundColor: Colors.crimson },
  text: { color: Colors.white, fontSize: 14 },
  input: { backgroundColor: '#2e3539', color: Colors.white, borderRadius: 8, padding: 10, minHeight: 60 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8 },
  cancel: { backgroundColor: '#444' },
  submit: { backgroundColor: Colors.crimson },
  btnText: { color: Colors.white, fontWeight: '700' },
});
