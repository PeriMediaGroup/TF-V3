import { Platform, ToastAndroid, Alert } from 'react-native';

export function showToast(message) {
  if (!message) return;
  if (Platform.OS === 'android') {
    try { ToastAndroid.show(String(message), ToastAndroid.SHORT); } catch {}
  } else {
    try { Alert.alert('', String(message)); } catch {}
  }
}

