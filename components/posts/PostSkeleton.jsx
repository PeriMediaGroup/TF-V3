import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../styles/ThemeContext';

export default function PostSkeleton() {
  const { theme } = useTheme();
  const muted = theme.cardSoft || '#e0e0e0';
  const card = theme.card || '#f2f2f2';

  return (
    <View style={[styles.card, { backgroundColor: card, borderColor: theme.border }]}>      
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: muted }]} />
        <View style={{ flex: 1 }}>
          <View style={[styles.line, { width: '40%', backgroundColor: muted }]} />
          <View style={[styles.line, { width: '25%', backgroundColor: muted, marginTop: 6 }]} />
        </View>
      </View>
      <View style={[styles.line, { width: '90%', backgroundColor: muted, marginTop: 10 }]} />
      <View style={[styles.line, { width: '75%', backgroundColor: muted, marginTop: 6 }]} />
      <View style={[styles.media, { backgroundColor: muted }]} />
      <View style={[styles.row, { justifyContent: 'space-between' }]}>        
        <View style={[styles.pill, { backgroundColor: muted }]} />
        <View style={[styles.pill, { backgroundColor: muted }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 16,
    padding: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 8 },
  line: { height: 12, borderRadius: 6 },
  media: { height: 180, borderRadius: 8, marginTop: 12, width: '100%' },
  pill: { height: 18, borderRadius: 9, marginTop: 12, width: 70 },
});

