import React from 'react';
import { Animated, Easing, Modal, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tappable } from './ui/tappable';
import { Text } from './ui/text';
import { NativeSheet } from './NativeSheet';
import { useOverlay, type DialogConfig } from '@/lib/overlay';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';

/** Root-mounted host for `showDialog` / `showMenu`. Render once, after the navigation stack. */
export function OverlayHost() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { dialog, menu, toast, closeDialog, closeMenu, closeToast } = useOverlay();

  // Auto-dismiss the toast.
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(closeToast, 2600);
    return () => clearTimeout(t);
  }, [toast, closeToast]);

  return (
    <>
      <DialogLayer dialog={dialog} onClose={closeDialog} colors={colors} />

      <NativeSheet visible={!!menu} onClose={closeMenu}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 }}>
          {menu?.title ? (
            <Text style={{ fontFamily: theme.fonts.semibold, fontSize: theme.type.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, paddingHorizontal: 8, paddingBottom: 6 }}>{menu.title}</Text>
          ) : null}
          {menu?.options.map((option, i) => (
            <View key={option.label}>
              {i > 0 && <View style={{ height: 1, backgroundColor: colors.borderLight, marginLeft: 8 }} />}
              <Tappable
                onPress={() => { closeMenu(); option.onPress(); }}
                accessibilityRole="button"
                accessibilityState={{ selected: !!option.selected }}
                accessibilityLabel={option.label}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 16 }}
              >
                <Text style={{ flex: 1, fontFamily: theme.fonts.medium, fontSize: theme.type.body, color: option.destructive ? colors.danger : colors.text }}>{option.label}</Text>
                {option.selected ? <Ionicons name="checkmark" size={20} color={colors.accent} /> : null}
              </Tappable>
            </View>
          ))}
          <View style={{ height: 12 }} />
          <Tappable
            onPress={closeMenu}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: theme.radii.md, backgroundColor: colors.surfaceMuted }}
          >
            <Text style={{ fontFamily: theme.fonts.semibold, fontSize: theme.type.body, color: colors.text }}>Cancel</Text>
          </Tappable>
        </View>
      </NativeSheet>

      {toast && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 24, right: 24, bottom: insets.bottom + 96, alignItems: 'center' }}>
          <View style={{ maxWidth: 420, backgroundColor: colors.snackbarBg, borderRadius: theme.radii.md, paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ color: colors.surface, fontSize: theme.type.label, fontFamily: theme.fonts.medium, textAlign: 'center' }}>{toast.message}</Text>
          </View>
        </View>
      )}
    </>
  );
}

/**
 * Dialog layer.
 *
 * `Modal`'s own `animationType` only plays on the way in — the view is torn down
 * as soon as `visible` flips, so the dismiss was a hard cut. This keeps the
 * content mounted through an exit animation and unmounts when it finishes.
 */
function DialogLayer({
  dialog,
  onClose,
  colors,
}: {
  dialog: DialogConfig | null;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = React.useState(false);
  const [shown, setShown] = React.useState<DialogConfig | null>(dialog);

  React.useEffect(() => {
    if (dialog) {
      setShown(dialog);
      setVisible(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    if (!visible) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setVisible(false);
        setShown(null);
      }
    });
  }, [dialog, visible, progress]);

  const cancelLabel = shown?.cancelLabel;
  const showCancel = cancelLabel !== null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          opacity: progress,
        }}
      >
        {shown && (
          <Animated.View
            style={{
              width: '100%',
              maxWidth: 340,
              backgroundColor: colors.surface,
              borderRadius: theme.radii.lg,
              borderWidth: 1,
              borderColor: colors.borderLight,
              padding: 20,
              ...theme.elevation.floating,
              opacity: progress,
              transform: [
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              ],
            }}
          >
            <Text style={{ fontFamily: theme.fonts.semibold, fontSize: theme.type.title, color: colors.text }}>{shown.title}</Text>
            {shown.message ? (
              <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: colors.textMuted, marginTop: 8, lineHeight: 20 }}>{shown.message}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              {showCancel && (
                <Tappable
                  onPress={() => { onClose(); shown.onCancel?.(); }}
                  accessibilityRole="button"
                  accessibilityLabel={cancelLabel ?? 'Cancel'}
                  style={{ paddingHorizontal: 16, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.md }}
                >
                  <Text style={{ fontFamily: theme.fonts.semibold, fontSize: theme.type.md, color: colors.textMuted }}>{cancelLabel ?? 'Cancel'}</Text>
                </Tappable>
              )}
              <Tappable
                haptic
                onPress={() => { onClose(); shown.onConfirm?.(); }}
                accessibilityRole="button"
                accessibilityLabel={shown.confirmLabel ?? 'OK'}
                style={{ paddingHorizontal: 18, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.md, backgroundColor: shown.destructive ? colors.danger : colors.accent }}
              >
                <Text style={{ fontFamily: theme.fonts.semibold, fontSize: theme.type.md, color: '#FFFFFF' }}>{shown.confirmLabel ?? 'OK'}</Text>
              </Tappable>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}
