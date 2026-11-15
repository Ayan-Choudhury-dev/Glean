import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Image, Linking, ActivityIndicator, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tappable } from '../components/ui/tappable';
import { Text } from '../components/ui/text';
import { PickerSheet } from '../components/PickerSheet';
import { useGleanStore, type InventoryItem } from '../store/useGleanStore';
import { lookupProduct } from '../lib/productLookup';
import { theme } from '@/constants/theme';
import { useColors } from '@/lib/appearance';
import { showToast } from '@/lib/overlay';
import { tapHaptic } from '@/lib/haptics';

const BARCODE_TYPES: NonNullable<
  React.ComponentProps<typeof CameraView>['barcodeScannerSettings']
>['barcodeTypes'] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14'];

/** Loose name key for matching a scanned product against what's already stored. */
const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

type Pending = {
  barcode: string;
  name: string;
  brand?: string;
  category: string;
  location: string;
  qty: number;
  imageUrl?: string;
  status: 'looking-up' | 'ready' | 'unknown';
  /** 'topup' when the item already exists in the pantry. */
  mode: 'new' | 'topup';
  existingId?: string;
};

export default function ScanScreen() {
  const { inventory, houseOptions, addInventoryItem, editInventoryItem, restockInventory, logConsumption, addHouseOption } = useGleanStore();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [pending, setPending] = useState<Pending[]>([]);
  const [continuous, setContinuous] = useState(false); // single scan is the default
  const [busy, setBusy] = useState(false);
  const [adds, setAdds] = useState(0);
  const [locationTarget, setLocationTarget] = useState<string | null>(null);
  // Remembered across scans so unpacking a bag doesn't mean re-picking each time.
  const [lastLocation, setLastLocation] = useState('');
  const [torch, setTorch] = useState(false);
  /** Barcode currently being renamed inline — unknown products are named here. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const locationOptions = useMemo(
    () => houseOptions.filter(o => o.type === 'location'),
    [houseOptions],
  );

  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const pausedRef = useRef(false);

  const findExisting = useCallback(
    (barcode: string, name?: string): InventoryItem | undefined => {
      const byBarcode = inventory.find(i => i.barcode === barcode);
      if (byBarcode) return byBarcode;
      if (!name) return undefined;
      const key = normalizeName(name);
      return inventory.find(i => normalizeName(i.name) === key);
    },
    [inventory],
  );

  const handleScan = useCallback(
    async ({ data }: { data: string }) => {
      const now = Date.now();
      if (pausedRef.current) return;
      // The camera fires continuously — ignore an immediate repeat of the same code.
      if (data === lastScan.current.code && now - lastScan.current.at < 2000) return;
      lastScan.current = { code: data, at: now };

      // Already in this batch: bump the quantity rather than adding a second row.
      if (pending.some(p => p.barcode === data)) {
        setPending(prev => prev.map(p => (p.barcode === data ? { ...p, qty: p.qty + 1 } : p)));
        return;
      }

      if (!continuous) pausedRef.current = true;

      tapHaptic();
      const known = findExisting(data);
      setPending(prev => [
        ...prev,
        {
          barcode: data,
          name: known?.name ?? '',
          category: known?.category ?? 'Other',
          // A fresh scan is never blocked on picking a location: remember the
          // last one, else fall back to Pantry and let the chip change it.
          location: known?.location ?? lastLocation ?? 'Pantry',
          qty: 1,
          imageUrl: known?.image_url,
          status: known ? 'ready' : 'looking-up',
          mode: known ? 'topup' : 'new',
          existingId: known?.id,
        },
      ]);

      if (known) return;

      const result = await lookupProduct(data);
      setPending(prev =>
        prev.map(p => {
          if (p.barcode !== data) return p;
          if (!result) return { ...p, name: `Item ${data.slice(-4)}`, status: 'unknown' as const };
          // The product may already be stocked under a different barcode (or none).
          const byName = findExisting('', result.name);
          return {
            ...p,
            name: result.name,
            brand: result.brand,
            category: byName?.category ?? result.category,
            location: p.location || byName?.location || lastLocation || 'Pantry',
            imageUrl: result.imageUrl ?? byName?.image_url,
            status: 'ready' as const,
            mode: byName ? ('topup' as const) : ('new' as const),
            existingId: byName?.id,
          };
        })
      );
    },
    [pending, continuous, findExisting, lastLocation]
  );

  const setQty = (barcode: string, delta: number) =>
    setPending(prev => prev.map(p => (p.barcode === barcode ? { ...p, qty: Math.max(1, p.qty + delta) } : p)));

  const remove = (barcode: string) => setPending(prev => prev.filter(p => p.barcode !== barcode));

  const commit = () => {
    if (busy || pending.length === 0) return;
    setBusy(true);

    let added = 0;
    let topped = 0;
    for (const p of pending) {
      if (p.mode === 'topup' && p.existingId) {
        restockInventory(p.existingId, p.qty);
        // Backfill the barcode so the next scan matches instantly.
        const existing = inventory.find(i => i.id === p.existingId);
        if (existing && !existing.barcode) editInventoryItem(p.existingId, { barcode: p.barcode });
        topped += 1;
        continue;
      }
      const id = addInventoryItem({
        name: p.name,
        qty: p.qty,
        category: p.category,
        location: p.location || undefined,
        image_url: p.imageUrl,
        barcode: p.barcode,
      });
      logConsumption(id, p.name, p.qty, 'added');
      added += 1;
    }

    setAdds(added + topped);
    setPending([]);
    setBusy(false);
    pausedRef.current = false;

    const parts = [];
    if (added) parts.push(`added ${added}`);
    if (topped) parts.push(`topped up ${topped}`);
    showToast(parts.length ? parts.join(' · ') : 'Nothing to add');
  };

  const openLocationPicker = (barcode: string) => setLocationTarget(barcode);

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 }}>
        <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
        <Text style={{ fontSize: theme.type.title, color: colors.text, fontFamily: theme.fonts.medium, textAlign: 'center' }}>
          Camera access needed
        </Text>
        <Text style={{ fontSize: theme.type.label, color: colors.textMuted, textAlign: 'center' }}>
          Glean uses the camera to scan product barcodes.
        </Text>
        <Tappable
          onPress={permission.canAskAgain ? requestPermission : () => Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel="Grant camera access"
          style={{ marginTop: 8, backgroundColor: colors.accent, borderRadius: theme.radii.md, minHeight: 48, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: colors.onAccent, fontFamily: theme.fonts.medium, fontSize: theme.type.md }}>
            {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
          </Text>
        </Tappable>
        <Tappable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={{ padding: 12 }}>
          <Text style={{ color: colors.textMuted, fontSize: theme.type.label }}>Not now</Text>
        </Tappable>
      </View>
    );
  }

  const needsLocation = pending.some(p => !p.location);
  const stillLooking = pending.some(p => p.status === 'looking-up');
  const canCommit = pending.length > 0 && !busy && !needsLocation && !stillLooking;
  const topupCount = pending.filter(p => p.mode === 'topup').length;
  const newCount = pending.length - topupCount;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        enableTorch={torch}
        onBarcodeScanned={pausedRef.current ? undefined : handleScan}
      >
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Tappable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Tappable>
          <View style={{ flex: 1 }} />
          <Tappable
            onPress={() => setTorch(t => !t)}
            accessibilityRole="button"
            accessibilityState={{ selected: torch }}
            accessibilityLabel={torch ? 'Turn the light off' : 'Turn the light on'}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: torch ? colors.accent : 'rgba(0,0,0,0.45)' }}
          >
            <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={18} color="#fff" />
          </Tappable>
          <Tappable
            onPress={() => router.push('/item-form')}
            accessibilityRole="button"
            accessibilityLabel="Enter an item manually"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: theme.type.caption, fontFamily: theme.fonts.medium }}>Enter manually</Text>
          </Tappable>
          <Tappable
            onPress={() => { setContinuous(c => !c); pausedRef.current = false; }}
            accessibilityRole="button"
            accessibilityState={{ selected: continuous }}
            accessibilityLabel={continuous ? 'Continuous scanning on' : 'Single scan mode'}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: continuous ? colors.accent : 'rgba(0,0,0,0.45)' }}
          >
            <Ionicons name="repeat" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: theme.type.caption, fontFamily: theme.fonts.medium }}>
              {continuous ? 'Continuous' : 'Single'}
            </Text>
          </Tappable>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <View style={{ width: 260, height: 170, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderRadius: theme.radii.lg }} />
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: theme.type.label, marginTop: 14 }}>
            {pausedRef.current ? 'Captured — tap Scan again' : 'Point at a barcode'}
          </Text>
        </View>
      </CameraView>

      <View style={{ backgroundColor: colors.background, borderTopLeftRadius: theme.radii.xl, borderTopRightRadius: theme.radii.xl, marginTop: -theme.radii.xl, paddingBottom: insets.bottom + 12, maxHeight: '58%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ flex: 1, fontSize: theme.type.title, color: colors.text, fontFamily: theme.fonts.medium }}>Scanned</Text>
          {!continuous && (
            <Tappable
              onPress={() => { pausedRef.current = false; lastScan.current = { code: '', at: 0 }; }}
              accessibilityRole="button"
              accessibilityLabel="Scan another"
              style={{ paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', borderRadius: theme.radii.pill, backgroundColor: colors.chipBg }}
            >
              <Text style={{ fontSize: theme.type.caption, color: colors.text, fontFamily: theme.fonts.medium }}>Scan again</Text>
            </Tappable>
          )}
        </View>

        {pending.length === 0 ? (
          <Text style={{ paddingHorizontal: 20, paddingVertical: 18, fontSize: theme.type.label, color: colors.textMuted }}>
            {adds > 0 ? `${adds} saved. Keep scanning.` : 'Scan a barcode to add an item.'}
          </Text>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}>
            {pending.map(p => (
              <View key={p.barcode} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                {p.imageUrl ? (
                  <Image source={{ uri: p.imageUrl }} style={{ width: 40, height: 40, borderRadius: theme.radii.sm, backgroundColor: colors.surfaceSunken }} />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: theme.radii.sm, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="barcode-outline" size={20} color={colors.textMuted} />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  {editing === p.barcode ? (
                    <TextInput
                      value={draftName}
                      onChangeText={setDraftName}
                      autoFocus
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        const name = draftName.trim();
                        if (name) {
                          setPending(prev => prev.map(q => (q.barcode === p.barcode ? { ...q, name, status: 'ready' } : q)));
                        }
                        setEditing(null);
                      }}
                      onBlur={() => setEditing(null)}
                      placeholder="Name this item"
                      placeholderTextColor={colors.textFaint}
                      style={{ backgroundColor: colors.surfaceMuted, borderRadius: theme.radii.sm, paddingHorizontal: 10, height: 34, fontSize: theme.type.body, color: colors.text }}
                    />
                  ) : (
                    <Tappable
                      onPress={() => {
                        if (p.status === 'looking-up') return;
                        setDraftName(p.name);
                        setEditing(p.barcode);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Rename ${p.name || 'this item'}`}
                    >
                      <Text style={{ fontSize: theme.type.body, color: colors.text, fontFamily: theme.fonts.medium }} numberOfLines={1}>
                        {p.status === 'looking-up' ? 'Looking up…' : p.name}
                      </Text>
                    </Tappable>
                  )}
                  <Text style={{ fontSize: theme.type.caption, color: p.status === 'unknown' ? colors.warning : colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                    {p.mode === 'topup' ? 'In pantry · tops up' : p.status === 'unknown' ? 'Not found — tap the name to set one' : p.category}
                  </Text>
                  <Tappable
                    onPress={() => openLocationPicker(p.barcode)}
                    accessibilityRole="button"
                    accessibilityLabel={`Set location for ${p.name}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 6, paddingVertical: 4, paddingHorizontal: 8, borderRadius: theme.radii.pill, backgroundColor: p.location ? colors.chipBg : colors.warningBg }}
                  >
                    <Ionicons
                      name={(locationOptions.find(o => o.name === p.location)?.icon ?? 'location-outline') as React.ComponentProps<typeof Ionicons>['name']}
                      size={12}
                      color={p.location ? colors.textMuted : colors.warning}
                    />
                    <Text style={{ fontSize: theme.type.caption, color: p.location ? colors.text : colors.warning, fontFamily: theme.fonts.medium }}>
                      {p.location || 'Set location'}
                    </Text>
                  </Tappable>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Tappable onPress={() => setQty(p.barcode, -1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Decrease ${p.name}`} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="remove" size={14} color={colors.text} />
                  </Tappable>
                  <Text style={{ minWidth: 18, textAlign: 'center', color: colors.text, fontFamily: theme.fonts.monoMedium, fontSize: theme.type.label }}>{p.qty}</Text>
                  <Tappable onPress={() => setQty(p.barcode, 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Increase ${p.name}`} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="add" size={14} color={colors.accent} />
                  </Tappable>
                  <Tappable onPress={() => remove(p.barcode)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Tappable>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <Tappable
          onPress={commit}
          disabled={!canCommit}
          haptic
          hapticStyle="confirm"
          accessibilityRole="button"
          accessibilityLabel={`Add ${pending.length} items to inventory`}
          style={{ marginHorizontal: 20, marginTop: 8, backgroundColor: colors.accent, borderRadius: theme.radii.md, minHeight: 52, alignItems: 'center', justifyContent: 'center', opacity: canCommit ? 1 : 0.5 }}
        >
          <Text style={{ color: colors.onAccent, fontSize: theme.type.body, fontFamily: theme.fonts.medium }}>
            {pending.length === 0
              ? 'Add to inventory'
              : needsLocation
                ? 'Set a location for each item'
                : stillLooking
                  ? 'Looking up…'
                  : `Add ${[
                      newCount ? `${newCount} new` : null,
                      topupCount ? `${topupCount} top-up${topupCount === 1 ? '' : 's'}` : null,
                    ].filter(Boolean).join(' · ')}`}
          </Text>
        </Tappable>
      </View>

      <PickerSheet
        visible={locationTarget !== null}
        title="Location"
        type="location"
        options={locationOptions}
        selected={pending.find(p => p.barcode === locationTarget)?.location ?? ''}
        onSelect={value => {
          setPending(prev => prev.map(p => (p.barcode === locationTarget ? { ...p, location: value } : p)));
          setLastLocation(value);
          setLocationTarget(null);
        }}
        onCreate={value => {
          const option = addHouseOption('location', value, 'location-outline');
          if (option) {
            setPending(prev => prev.map(p => (p.barcode === locationTarget ? { ...p, location: option.name } : p)));
            setLastLocation(option.name);
          }
          setLocationTarget(null);
        }}
        onClose={() => setLocationTarget(null)}
      />
    </View>
  );
}
