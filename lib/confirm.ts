import { Alert, Platform } from 'react-native';

import { TEXTS } from '@/constants/texts';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

// O'chirishdan oldin so'rash. Telefonda — tizim oynasi (Alert),
// vebda (iPhone Safari'dagi versiya) — brauzerning confirm oynasi,
// chunki vebda Alert tugmalari ishlamaydi.
export function confirmDestructive({ title, message, confirmLabel, onConfirm }: ConfirmOptions): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: TEXTS.common.cancel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
