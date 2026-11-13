import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { NativeSheet } from './NativeSheet';
import { Text } from './ui/text';
import { Tappable } from './ui/tappable';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { currentVersion, useUpdateFlow } from '@/lib/updates';

/**
 * The whole update conversation in one sheet.
 *
 * A 46 MB download with no feedback is the bad part of updating, so the sheet
 * owns the progress, the failure, and the "what happens next" line. Mounted
 * once at the root; the Settings row and the launch check both drive it.
 */
export function UpdateSheet() {
  const colors = useColors();
  const { phase, info, progress, error, open, closeSheet, install } = useUpdateFlow();

  const mb = (bytes: number | null) => (bytes ? `${Math.round(bytes / 1048576)} MB` : null);
  const percent = Math.round(progress * 100);

  return (
    <NativeSheet visible={open} onClose={closeSheet}>
      <View style={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: theme.radii.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="cloud-download-outline" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: colors.text }}>
              {phase === 'error' ? 'Update failed' : phase === 'opening' ? 'Finish in Android' : `Glean ${info?.version ?? ''}`}
            </Text>
            <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: colors.textMuted, marginTop: 2 }}>
              {phase === 'downloading'
                ? `${percent}% · ${mb(info?.apkSize ?? null) ?? 'downloading'}`
                : phase === 'opening'
                  ? 'The installer is open'
                  : `You are on ${currentVersion()}`}
            </Text>
          </View>
        </View>

        {/* Body changes with the phase; the sheet never reshuffles its buttons. */}
        {phase === 'available' && (
          <Text style={{ color: colors.textMuted, fontSize: theme.type.label, lineHeight: 21 }}>
            Installing replaces the app and keeps your pantry. Android will ask once whether Glean may install apps.
          </Text>
        )}

        {phase === 'downloading' && (
          <View style={{ gap: 8 }}>
            <View style={{ height: 8, borderRadius: theme.radii.pill, backgroundColor: colors.surfaceSunken, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(percent, 3)}%`, height: '100%', borderRadius: theme.radii.pill, backgroundColor: colors.accent }} />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: theme.type.caption }}>
              Keep the app open until the installer appears.
            </Text>
          </View>
        )}

        {phase === 'opening' && (
          <Text style={{ color: colors.textMuted, fontSize: theme.type.label, lineHeight: 21 }}>
            Android is showing the install prompt. Choose Update — your pantry stays as it is. The download is kept, so you can install it later from Settings if you close this.
          </Text>
        )}

        {phase === 'error' && (
          <View style={{ backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: theme.radii.md, padding: 14 }}>
            <Text style={{ color: colors.dangerText, fontSize: theme.type.caption, lineHeight: 19 }}>{error}</Text>
          </View>
        )}

        <View style={{ gap: 10, marginTop: 4 }}>
          {phase === 'available' && (
            <Primary label="Install update" onPress={() => { void install(); }} />
          )}

          {phase === 'downloading' && (
            <Primary label={`Downloading… ${percent}%`} onPress={() => {}} disabled busy />
          )}

          {phase === 'error' && (
            <>
              <Primary label="Try again" onPress={() => { void install(); }} />
              <Secondary
                label="Open the release page"
                onPress={() => { if (info?.url) void Linking.openURL(info.url); }}
              />
            </>
          )}

          {phase === 'opening' && (
            <Secondary label="Done" onPress={closeSheet} />
          )}
        </View>
      </View>
    </NativeSheet>
  );
}

function Primary({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  const colors = useColors();
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      haptic
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={{
        minHeight: 52,
        borderRadius: theme.radii.md,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: disabled ? 0.85 : 1,
      }}
    >
      {busy && <ActivityIndicator color={colors.onAccent} />}
      <Text style={{ color: colors.onAccent, fontSize: theme.type.md, fontFamily: theme.fonts.medium }}>{label}</Text>
    </Tappable>
  );
}

function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ minHeight: 48, borderRadius: theme.radii.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: colors.text, fontSize: theme.type.md, fontFamily: theme.fonts.medium }}>{label}</Text>
    </Tappable>
  );
}
