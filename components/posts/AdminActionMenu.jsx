import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../styles/GlobalStyles';

export default function AdminActionMenu({ visible, onClose, onDelete, onAskReason, onOpenDashboard }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Admin Actions</Text>
          <TouchableOpacity style={[styles.btn, styles.destructive]} onPress={onDelete}>
            <Text style={styles.btnText}>Delete Post</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.destructive]} onPress={onAskReason}>
            <Text style={styles.btnText}>Delete with reason…</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn]} onPress={onOpenDashboard}>
            <Text style={styles.btnText}>Open Admin Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn]} onPress={onClose}>
            <Text style={styles.btnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.gunmetal,
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  title: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  btn: {
    paddingVertical: 12,
  },
  btnText: {
    color: Colors.white,
    fontSize: 14,
    textAlign: 'center',
  },
  destructive: {
    backgroundColor: '#7a1b1b',
    borderRadius: 8,
    marginBottom: 8,
  },
});
