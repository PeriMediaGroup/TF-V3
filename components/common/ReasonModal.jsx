import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../styles/GlobalStyles';

export default function ReasonModal({ visible, title = 'Enter reason', placeholder = 'Reason…', onCancel, onSubmit }) {
  const [text, setText] = useState('');

  const submit = () => {
    const val = text.trim();
    onSubmit?.(val);
    setText('');
  };

  const cancel = () => {
    setText('');
    onCancel?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#999"
            onChangeText={setText}
            value={text}
            multiline
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={cancel}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.submit]} onPress={submit}>
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
  input: { backgroundColor: '#2e3539', color: Colors.white, borderRadius: 8, padding: 10, minHeight: 80 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8 },
  cancel: { backgroundColor: '#444' },
  submit: { backgroundColor: Colors.crimson },
  btnText: { color: Colors.white, fontWeight: '700' },
});

