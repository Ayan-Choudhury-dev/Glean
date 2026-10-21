import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { enqueue, flushQueue } from '../lib/syncQueue';
import { deleteItemImage } from '../lib/upload';
import { saveProfile, loadProfile, clearProfile } from '../lib/profileCache';
import { localSaveHouse, localLoadHouse, localClearHouse } from '../lib/db/client';
import { RECENT_ACTIVITY_FETCH_LIMIT } from '../constants/config';

// ─── UUID helper ──────────────────────────────────────────────────────────────

function uid(): string {
  // Uses native crypto when available (Hermes / modern RN)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Models ───────────────────────────────────────────────────────────────────

export interface Profile {
  id:       string;
  name:     string;
  house_id: string | null;
  avatar_url?: string | null;
}

export interface Member {
  id:         string;
  name:       string;
  avatar_url?: string | null;
}

export interface House {
  id:          string;
  name:        string;
  invite_code: string;
  owner_id:    string;
  image_key?:  string | null;
  members:     Member[];
}

export interface InventoryItem {
  id:             string;
  name:           string;
  qty:            number;
  category:       string;
  location?:      string;
  image_url?:     string;
  barcode?:       string;
  last_restocked?: string;
}

export interface ShoppingItem {
  id:           string;
  inventory_id?: string;
  name:         string;
  target_qty:   number;
  status:       'to_buy' | 'purchased';
}

export interface ConsumptionLog {
  id:           string;
  inventory_id: string;
  item_name:    string;
  house_id:     string;
  consumed_at:  string;
  qty:          number;
  action:       'used' | 'restocked' | 'added';
  /** Member who made the change (null on rows written before attribution existed). */
  user_id?:     string | null;
}

export type HouseOptionType = 'category' | 'location';

export interface HouseOption {
  id: string;
  house_id: string;
  type: HouseOptionType;
  name: string;
  icon: string;
  created_by?: string;
}

export const DEFAULT_HOUSE_OPTIONS: Omit<HouseOption, 'id' | 'house_id' | 'created_by'>[] = [
  { type: 'category', name: 'Dairy', icon: 'water-outline' },
  { type: 'category', name: 'Grains', icon: 'layers-outline' },
  { type: 'category', name: 'Spices', icon: 'flame-outline' },
  { type: 'category', name: 'Vegetables', icon: 'leaf-outline' },
  { type: 'category', name: 'Fruits', icon: 'nutrition-outline' },
  { type: 'category', name: 'Meat & Fish', icon: 'fish-outline' },
  { type: 'category', name: 'Beverages', icon: 'wine-outline' },
  { type: 'category', name: 'Snacks', icon: 'fast-food-outline' },
  { type: 'category', name: 'Cleaning', icon: 'sparkles-outline' },
  { type: 'category', name: 'Personal Care', icon: 'body-outline' },
  { type: 'category', name: 'Other', icon: 'pricetag-outline' },
  { type: 'location', name: 'Fridge', icon: 'snow-outline' },
  { type: 'location', name: 'Freezer', icon: 'snow-outline' },
  { type: 'location', name: 'Pantry', icon: 'file-tray-stacked-outline' },
  { type: 'location', name: 'Cupboard', icon: 'file-tray-stacked-outline' },
  { type: 'location', name: 'Kitchen', icon: 'home-outline' },
  { type: 'location', name: 'Kitchen cabinet', icon: 'file-tray-stacked-outline' },
  { type: 'location', name: 'Counter', icon: 'albums-outline' },
  { type: 'location', name: 'Bathroom', icon: 'water-outline' },
  { type: 'location', name: 'Other', icon: 'location-outline' },
];

// ─── CSV parser ───────────────────────────────────────────────────────────────

type CSVRow = Pick<InventoryItem, 'name' | 'qty' | 'category'> & { location?: string };

function parseCSVRows(text: string): CSVRow[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines
    .slice(1)
    .map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
      return {
        name:     row['name'] ?? '',
        qty:      Math.max(0, parseInt(row['quantity'] ?? '0', 10) || 0),
        category: row['category'] || 'Other',
        location: row['location'] || undefined,
      };
    })
    .filter(r => r.name.length > 0);
}

// ─── State interface ──────────────────────────────────────────────────────────

interface GleanState {
  profile:         Profile | null;
  house:           House | null;
  inventory:       InventoryItem[];
  shoppingList:    ShoppingItem[];
  consumptionLogs: ConsumptionLog[];
  houseOptions: HouseOption[];
  loading: boolean;
  /** True once the persisted session has been restored (or confirmed absent). */
  sessionLoaded: boolean;
  syncError: string | null;
  lastPantryUpdate: {
    items: ShoppingItem[];
    previousInventory: InventoryItem[];
    createdInventoryIds: string[];
  } | null;

  // Auth
  signUp:   (name: string, email: string, password: string) => Promise<string | null>;
  signIn:           (email: string, password: string)               => Promise<string | null>;
  signInWithMagicLink: (email: string)                              => Promise<string | null>;
  sendPasswordReset:   (email: string)                              => Promise<string | null>;
  updatePassword:      (password: string)                           => Promise<string | null>;
  handleAuthRedirect:  (url: string)                               => Promise<void>;
  signOut:      ()                                              => Promise<void>;
  clearSession: ()                                              => void;
  clearSyncError: ()                                            => void;
  setAvatar:    (url: string | null)                            => void;
  setName:      (name: string)                                  => void;
  loadSession:  ()                                              => Promise<void>;

  // House
  createHouse: (name: string) => Promise<House | string>; // returns House or error string
  joinHouse:   (inviteCode: string) => Promise<boolean>;
  renameHouse: (name: string) => Promise<boolean>;
  setHouseImage: (imageKey: string | null) => Promise<boolean>;
  leaveHouse:  () => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  /** Re-read own membership from the DB (e.g. after being removed by the owner). */
  refreshMembership: () => Promise<void>;

  // Data sync: load everything from Supabase for the current house
  loadHouseData: (houseId: string) => Promise<void>;
  addHouseOption: (type: HouseOptionType, name: string, icon: string) => HouseOption | null;

  // Inventory
  adjustInventoryQty:  (id: string, delta: number, action?: 'used' | 'restocked') => void;
  /** Add stock atomically on the server (safe when several phones restock at once). */
  restockInventory:    (id: string, qty: number) => void;
  addInventoryItem:    (item: Omit<InventoryItem, 'id'>)                    => string;
  editInventoryItem:   (id: string, updates: Partial<Omit<InventoryItem, 'id'>>) => void;
  deleteInventoryItem: (id: string)                                         => void;

  // Consumption log
  logConsumption: (inventoryId: string, itemName: string, qty: number, action?: 'used' | 'restocked' | 'added') => void;

  // Shopping list
  addToShoppingList:   (name: string, inventoryId?: string, targetQty?: number) => void;
  adjustShoppingQty:  (id: string, delta: number) => void;
  markAsPurchased:     (id: string) => void;
  unmarkPurchased:     (id: string) => void;
  removeFromShoppingList: (id: string) => void;
  clearPurchased:      ()            => void;
  updatePantry:        ()            => void;
  undoLastPantryUpdate: ()            => void;

  // CSV
  importCSV: (csvText: string) => { added: number; updated: number };
}

// ─── Supabase sync helpers (fire-and-forget) ──────────────────────────────────

function reportSyncError(message: string) {
  try {
    useGleanStore.setState({ syncError: message });
  } catch {
    /* store not initialised yet */
  }
}

function sbInsert(table: string, row: Record<string, unknown>) {
  supabase.from(table).insert(row).then(({ error }) => {
    if (error) {
      console.error(`[sb] insert ${table}:`, error.message);
      enqueue({ table, kind: 'insert', payload: row });
      reportSyncError("Couldn't save changes — check your connection.");
    } else {
      void flushQueue();
    }
  });
}

function sbUpdate(table: string, id: string, updates: Record<string, unknown>) {
  supabase.from(table).update(updates).eq('id', id).then(({ error }) => {
    if (error) {
      console.error(`[sb] update ${table}:`, error.message);
      enqueue({ table, kind: 'update', id, payload: updates });
      reportSyncError("Couldn't save changes — check your connection.");
    } else {
      void flushQueue();
    }
  });
}

const delayedUpdates = new Map<string, {
  timer: ReturnType<typeof setTimeout>;
  updates: Record<string, unknown>;
}>();

let delayedLogs: ConsumptionLog[] = [];
let delayedLogsTimer: ReturnType<typeof setTimeout> | null = null;

function sbInsertConsumptionLog(log: ConsumptionLog) {
  delayedLogs.push(log);
  if (delayedLogsTimer) clearTimeout(delayedLogsTimer);
  delayedLogsTimer = setTimeout(() => {
    const logs = delayedLogs;
    delayedLogs = [];
    delayedLogsTimer = null;
    if (logs.length > 0) {
      supabase.from('consumption_logs').insert(logs as unknown as Record<string, unknown>[]).then(({ error }) => {
        if (error) {
          console.error('[sb] insert consumption_logs:', error.message);
          enqueue({ table: 'consumption_logs', kind: 'insert', payload: logs });
          reportSyncError("Couldn't save changes — check your connection.");
        } else {
          void flushQueue();
        }
      });
    }
  }, 500);
}

function sbUpdateDelayed(table: string, id: string, updates: Record<string, unknown>) {
  const key = `${table}:${id}`;
  const pending = delayedUpdates.get(key);
  if (pending) clearTimeout(pending.timer);
  const mergedUpdates = { ...pending?.updates, ...updates };

  const timer = setTimeout(() => {
    delayedUpdates.delete(key);
    sbUpdate(table, id, mergedUpdates);
  }, 500);
  delayedUpdates.set(key, { timer, updates: mergedUpdates });
}

function cancelDelayedUpdate(table: string, id: string) {
  const key = `${table}:${id}`;
  const pending = delayedUpdates.get(key);
  if (pending) {
    clearTimeout(pending.timer);
    delayedUpdates.delete(key);
  }
}

function sbDelete(table: string, id: string) {
  supabase.from(table).delete().eq('id', id).then(({ error }) => {
    if (error) {
      console.error(`[sb] delete ${table}:`, error.message);
      enqueue({ table, kind: 'delete', id });
      reportSyncError("Couldn't save changes — check your connection.");
    } else {
      void flushQueue();
    }
  });
}

// ─── Realtime sync (multi-user) ────────────────────────────────────────────────

type RealtimeTable = 'inventory' | 'shopping_list' | 'consumption_logs';

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

/** Keep only the newest RECENT_ACTIVITY_FETCH_LIMIT logs in memory. */
function capLogs(logs: ConsumptionLog[]): ConsumptionLog[] {
  if (logs.length <= RECENT_ACTIVITY_FETCH_LIMIT) return logs;
  return [...logs]
    .sort((a, b) => new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime())
    .slice(0, RECENT_ACTIVITY_FETCH_LIMIT);
}

function applyRealtimeChange(
  state: GleanState,
  table: RealtimeTable,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  row: { id: string },
): Partial<GleanState> {
  const key = table === 'inventory' ? 'inventory'
    : table === 'shopping_list' ? 'shoppingList'
      : 'consumptionLogs';
  const list = state[key] as { id: string }[];
  if (eventType === 'DELETE') {
    return { [key]: list.filter(x => x.id !== row.id) } as Partial<GleanState>;
  }
  const exists = list.some(x => x.id === row.id);
  const next = exists ? list.map(x => (x.id === row.id ? row : x)) : [...list, row];
  return {
    [key]: table === 'consumption_logs' ? capLogs(next as unknown as ConsumptionLog[]) : next,
  } as Partial<GleanState>;
}

interface RealtimeChannelLike {
  on: (
    event: string,
    filter: unknown,
    cb: (p: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: { id: string }; old: { id: string } }) => void,
  ) => RealtimeChannelLike;
  subscribe: () => unknown;
}

function startRealtime(houseId: string) {
  if (realtimeChannel) return;
  const channel = supabase.channel(`house:${houseId}`) as unknown as RealtimeChannelLike;
  const handle = (table: RealtimeTable) => (p: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: { id: string }; old: { id: string } }) =>
    useGleanStore.setState(s => applyRealtimeChange(s, table, p.eventType, p.eventType === 'DELETE' ? p.old : p.new));

  realtimeChannel = channel
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `house_id=eq.${houseId}` }, handle('inventory'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list', filter: `house_id=eq.${houseId}` }, handle('shopping_list'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'consumption_logs', filter: `house_id=eq.${houseId}` }, handle('consumption_logs'))
    .subscribe() as ReturnType<typeof supabase.channel>;
}

function stopRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGleanStore = create<GleanState>((set, get) => ({
  profile:         null,
  house:           null,
  inventory:       [],
  shoppingList:    [],
  consumptionLogs: [],
  houseOptions: [],
  loading: false,
  sessionLoaded: false,
  syncError: null,
  lastPantryUpdate: null,

  // ── Auth ──────────────────────────────────────────────────────────────────

  signUp: async (name, email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) return error.message;
      if (!data.user) return 'Sign-up failed. Please try again.';

      // Email confirmation is enabled on the Supabase project — no active
      // session yet, so the user must confirm before we can proceed.
      if (!data.session) {
        return 'Account created — check your email to confirm, then sign in.';
      }

      // Profile is normally auto-created by the DB trigger; upsert as a
      // fallback so sign-up never fails if that trigger isn't installed.
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: data.user.id, name, house_id: null }, { onConflict: 'id' });

      set({ profile: { id: data.user.id, name, house_id: null } });

      if (profileError) {
        console.warn('[auth] profile upsert:', profileError.message);
        return null;
      }
      return null; // null = success
    } catch (e) {
      console.error('[auth] signUp network error:', e);
      return 'Cannot reach Glean servers. Check your connection and Supabase setup, then retry.';
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;

      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      // Profile row missing (trigger not installed) — create it so sign-in works.
      if (!profile) {
        const name =
          (data.user.user_metadata?.name as string) || data.user.email || 'New user';
        await supabase.from('profiles').upsert(
          { id: data.user.id, name, house_id: null },
          { onConflict: 'id' }
        );
        profile = { id: data.user.id, name, house_id: null };
      }

      set({ profile });

      if (profile.house_id) {
        await get().loadHouseData(profile.house_id);
      }

      return null;
    } catch (e) {
      console.error('[auth] signIn network error:', e);
      return 'Cannot reach Glean servers. Check your connection and Supabase setup, then retry.';
    }
  },

  signInWithMagicLink: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'glean://' },
    });
    if (error) return error.message;
    return null;
  },

  sendPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'glean://reset-password',
    });
    if (error) return error.message;
    return null;
  },

  updatePassword: async (password) => {
    if (password.length < 6) return 'Use at least 6 characters.';
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message;
    return null;
  },

  handleAuthRedirect: async (url) => {
    const parsed = new URL(url);
    // Supabase puts tokens in the hash fragment: #access_token=...&refresh_token=...
    const fragment = parsed.hash.substring(1);
    if (!fragment) return;

    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) return;

    const { data: sessionData, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error || !sessionData.user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sessionData.user.id)
      .single();

    if (!profile) return;

    set({ profile });
    if (profile.house_id) {
      await get().loadHouseData(profile.house_id);
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[auth] signOut error:', e);
    }
    get().clearSession();
  },

  clearSession: () => {
    stopRealtime();
    set({ profile: null, house: null, inventory: [], shoppingList: [], consumptionLogs: [], houseOptions: [], lastPantryUpdate: null });
    void localClearHouse();
  },

  clearSyncError: () => set({ syncError: null }),

  setAvatar: (url) => {
    const { profile } = get();
    if (!profile) return;
    set({ profile: { ...profile, avatar_url: url } });
    supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id).then(({ error }) => {
      if (error) {
        console.error('[sb] update profiles.avatar_url:', error.message);
        reportSyncError("Couldn't save your photo — check your connection.");
      }
    });
  },

  setName: (name) => {
    const { profile } = get();
    if (!profile) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile.name) return;
    set({ profile: { ...profile, name: trimmed } });
    supabase.from('profiles').update({ name: trimmed }).eq('id', profile.id).then(({ error }) => {
      if (error) {
        console.error('[sb] update profiles.name:', error.message);
        reportSyncError("Couldn't save your name — check your connection.");
      }
    });
  },

  loadSession: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        set({ profile });
        if (profile.house_id) await get().loadHouseData(profile.house_id);
      } else if (error) {
        // Offline / fetch failed: fall back to the last-known profile so a
        // signed-in user still lands in the app instead of the login screen.
        const cached = await loadProfile<Profile>();
        if (cached) set({ profile: cached });
      }
    } finally {
      // Mark boot done even on failure, so the app renders (logged-out).
      set({ sessionLoaded: true });
    }
  },

  // ── House ─────────────────────────────────────────────────────────────────

  createHouse: async (name) => {
    const { profile } = get();
    if (!profile) return 'Not signed in.';

    // Atomic on the server: house row + profile link in one transaction, with a
    // cryptographically-random invite code.
    const { data, error } = await supabase.rpc('create_house', { p_name: name });

    if (error) return error.message;

    const row = (Array.isArray(data) ? data[0] : data) as
      | { house_id: string; invite_code: string }
      | undefined;
    if (!row?.house_id) return 'Could not create the household.';

    const houseId = row.house_id;

    const seededOptions = DEFAULT_HOUSE_OPTIONS.map(option => ({
      ...option,
      id: uid(),
      house_id: houseId,
      created_by: profile.id,
    }));
    await supabase.from('house_options').insert(seededOptions);

    const house: House = {
      id: houseId,
      name: name.trim(),
      invite_code: row.invite_code,
      owner_id: profile.id,
      image_key: null,
      members: [{ id: profile.id, name: profile.name, avatar_url: profile.avatar_url }],
    };
    set({ house, profile: { ...profile, house_id: houseId }, houseOptions: seededOptions });
    return house;
  },

  joinHouse: async (inviteCode) => {
    const { profile } = get();
    if (!profile) return false;

    const { data: houseId, error } = await supabase.rpc('join_house', {
      invite: inviteCode.trim().toUpperCase(),
    });

    if (error) {
      console.error('[sb] rpc join_house:', error.message);
      reportSyncError("Couldn't join — check your connection.");
      return false;
    }
    if (!houseId) {
      console.warn('[sb] join_house: no house for code', inviteCode.trim().toUpperCase());
      return false;
    }

    set({ profile: { ...profile, house_id: houseId } });
    await get().loadHouseData(houseId);
    return true;
  },

  setHouseImage: async (imageKey) => {
    const { house, profile } = get();
    if (!house) return false;
    // Owner-only, matching rename/kick.
    if (profile && house.owner_id && profile.id !== house.owner_id) return false;

    set(state => (state.house ? { house: { ...state.house, image_key: imageKey } } : {}));

    const { error } = await supabase.from('houses').update({ image_key: imageKey }).eq('id', house.id);
    if (error) {
      console.error('[sb] update houses.image_key:', error.message);
      reportSyncError("Couldn't save the house image.");
      return false;
    }
    return true;
  },

  renameHouse: async (name) => {
    const { house, profile } = get();
    const trimmed = name.trim();
    if (!house || !trimmed) return false;
    // ponytail: app-side owner gate; RLS lets any member update. Move to an RPC if abuse matters.
    if (profile && house.owner_id && profile.id !== house.owner_id) return false;

    set(state => (state.house ? { house: { ...state.house, name: trimmed } } : {}));

    const { error } = await supabase.from('houses').update({ name: trimmed }).eq('id', house.id);
    if (error) {
      console.error('[sb] update houses.name:', error.message);
      reportSyncError("Couldn't rename the household.");
      return false;
    }
    return true;
  },

  leaveHouse: async () => {
    const { profile } = get();
    if (!profile) return;

    const { error } = await supabase.rpc('leave_house');
    if (error) {
      console.error('[sb] rpc leave_house:', error.message);
      reportSyncError("Couldn't leave the household.");
      return;
    }

    stopRealtime();
    void localClearHouse();
    set({
      profile: { ...profile, house_id: null },
      house: null,
      inventory: [],
      shoppingList: [],
      consumptionLogs: [],
      houseOptions: [],
    });
  },

  removeMember: async (memberId) => {
    const { house } = get();
    if (!house) return;

    const { error } = await supabase.rpc('remove_member', { target: memberId });
    if (error) {
      console.error('[sb] rpc remove_member:', error.message);
      reportSyncError("Couldn't remove that member.");
      return;
    }

    set(state => (state.house
      ? { house: { ...state.house, members: state.house.members.filter(m => m.id !== memberId) } }
      : {}));
  },

  refreshMembership: async () => {
    const { profile } = get();
    if (!profile) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('house_id')
      .eq('id', profile.id)
      .single();
    if (error || !data) return;

    const remote = (data.house_id as string | null) ?? null;
    if (remote === (profile.house_id ?? null)) return; // unchanged

    if (remote) {
      set({ profile: { ...profile, house_id: remote } });
      await get().loadHouseData(remote);
      return;
    }

    // No longer in a house (removed by the owner, or left elsewhere) — drop all
    // local house state so the UI cannot show another house's data.
    stopRealtime();
    void localClearHouse();
    set({
      profile: { ...profile, house_id: null },
      house: null,
      inventory: [],
      shoppingList: [],
      consumptionLogs: [],
      houseOptions: [],
    });
  },

  // ── Data loading ──────────────────────────────────────────────────────────

  loadHouseData: async (houseId) => {
    // 1. Paint instantly from the local cache when this house was last synced.
    const cached = await localLoadHouse(houseId);
    if (cached) {
      set({
        inventory: cached.inventory,
        shoppingList: cached.shoppingList,
        consumptionLogs: cached.consumptionLogs,
        house: cached.house,
        houseOptions: cached.houseOptions,
        loading: false,
      });
    } else {
      set({ loading: true });
    }

    // 2. Fetch fresh from Supabase (authoritative while household sync is live).
    const [invRes, shopRes, logRes, houseRes, optionsRes, memberRes] = await Promise.all([
      supabase.from('inventory').select('*').eq('house_id', houseId),
      supabase.from('shopping_list').select('*').eq('house_id', houseId),
      supabase.from('consumption_logs').select('*').eq('house_id', houseId).order('consumed_at', { ascending: false }).limit(RECENT_ACTIVITY_FETCH_LIMIT),
      supabase.from('houses').select('*').eq('id', houseId).single(),
      supabase.from('house_options').select('*').eq('house_id', houseId).order('type').order('name'),
      supabase.from('profiles').select('id, name, avatar_url').eq('house_id', houseId),
    ]);

    const loadedOptions = optionsRes.data ?? [];
    const houseOptions = loadedOptions.length > 0
      ? loadedOptions as HouseOption[]
      : DEFAULT_HOUSE_OPTIONS.map(option => ({ ...option, id: uid(), house_id: houseId }));

    if (loadedOptions.length === 0 && !optionsRes.error) {
      await supabase.from('house_options').insert(
        houseOptions.map(option => ({ ...option, house_id: houseId }))
      );
    }

    const freshHouse = houseRes.data
      ? { ...(houseRes.data as House), members: ((memberRes.data ?? []) as Member[]) }
      : null;

    // Only overwrite cached data when the fetch succeeded; otherwise keep the
    // cached pantry (offline resilience) instead of blanking it.
    const freshOk = !invRes.error && !shopRes.error && !logRes.error && !houseRes.error && !optionsRes.error;
    if (freshOk) {
      set({
        inventory:       invRes.data   ?? [],
        shoppingList:    shopRes.data  ?? [],
        consumptionLogs: logRes.data   ?? [],
        house:           freshHouse,
        houseOptions,
        loading: false,
      });
      if (freshHouse) {
        void localSaveHouse(houseId, {
          house: freshHouse,
          inventory:       invRes.data   ?? [],
          shoppingList:    shopRes.data  ?? [],
          consumptionLogs: logRes.data   ?? [],
          houseOptions,
        });
      }
    } else {
      set({ loading: false });
      reportSyncError("Couldn't load fresh data — showing saved pantry.");
    }

    startRealtime(houseId);
  },

  addHouseOption: (type, name, icon) => {
    const { house, profile, houseOptions } = get();
    const trimmedName = name.trim();
    if (!house || !trimmedName) return null;
    const duplicate = houseOptions.find(option => option.type === type && option.name.toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) return duplicate;

    const option: HouseOption = {
      id: uid(),
      house_id: house.id,
      type,
      name: trimmedName,
      icon,
      created_by: profile?.id,
    };
    set(state => ({ houseOptions: [...state.houseOptions, option] }));
    sbInsert('house_options', option as unknown as Record<string, unknown>);
    return option;
  },

  // ── Inventory ─────────────────────────────────────────────────────────────

  adjustInventoryQty: (id, delta, action = delta < 0 ? 'used' : 'restocked') => {
    const { profile, house } = get();
    let changedItem: InventoryItem | undefined;
    let log: ConsumptionLog | undefined;

    set(state => {
      const item = state.inventory.find(i => i.id === id);
      if (!item) return state;
      changedItem = { ...item, qty: Math.max(0, item.qty + delta) };
      log = {
        id: uid(),
        inventory_id: id,
        item_name: item.name,
        house_id: profile?.house_id ?? '',
        consumed_at: new Date().toISOString(),
        qty: Math.abs(delta),
        action,
        user_id: profile?.id ?? null,
      };
      return {
        inventory: state.inventory.map(current => current.id === id ? changedItem! : current),
        consumptionLogs: capLogs([...state.consumptionLogs, log]),
      };
    });

    if (changedItem && house) sbUpdateDelayed('inventory', id, { qty: changedItem.qty });
    if (log?.house_id) sbInsertConsumptionLog(log);
  },

  restockInventory: (id, qty) => {
    if (qty <= 0) return;

    // Optimistic bump; the RPC returns the authoritative quantity and also
    // writes the consumption log server-side.
    set(state => ({
      inventory: state.inventory.map(i =>
        i.id === id ? { ...i, qty: i.qty + qty, last_restocked: new Date().toISOString() } : i
      ),
    }));

    supabase.rpc('restock_inventory', { p_id: id, p_qty: qty }).then(({ data, error }) => {
      if (error) {
        console.error('[sb] rpc restock_inventory:', error.message);
        reportSyncError("Couldn't update the pantry — check your connection.");
        return;
      }
      if (typeof data === 'number') {
        set(state => ({
          inventory: state.inventory.map(i => (i.id === id ? { ...i, qty: data } : i)),
        }));
      }
    });
  },

  addInventoryItem: (item) => {
    const { house } = get();
    const newItem = { ...item, id: uid() };
    set(state => ({ inventory: [...state.inventory, newItem] }));
    if (house) sbInsert('inventory', { ...newItem, house_id: house.id });
    return newItem.id;
  },

  editInventoryItem: (id, updates) => {
    set(state => ({
      inventory: state.inventory.map(i => i.id === id ? { ...i, ...updates } : i),
    }));
    sbUpdate('inventory', id, updates);
  },

  deleteInventoryItem: (id) => {
    set(state => ({
      inventory:    state.inventory.filter(i => i.id !== id),
      shoppingList: state.shoppingList.filter(s => s.inventory_id !== id),
    }));
    sbDelete('inventory', id);
    // Remove the stored image so it doesn't orphan in the bucket.
    const { house } = get();
    if (house) void deleteItemImage(house.id, id);
    // shopping_list rows cascade via inventory_id FK SET NULL — clean up nulled rows
    supabase.from('shopping_list').delete().eq('inventory_id', id)
      .then(({ error }) => { if (error) console.error('[sb] cleanup shopping_list:', error.message); });
  },

  // ── Consumption log ───────────────────────────────────────────────────────

  logConsumption: (inventoryId, itemName, qty, action = 'used') => {
    const { profile } = get();
    const log: ConsumptionLog = {
      id:           uid(),
      inventory_id: inventoryId,
      item_name:    itemName,
      house_id:     profile?.house_id ?? '',
      consumed_at:  new Date().toISOString(),
      qty,
      action,
      user_id:      profile?.id ?? null,
    };
    set(state => ({ consumptionLogs: capLogs([...state.consumptionLogs, log]) }));
    if (profile?.house_id) sbInsertConsumptionLog(log);
  },

  // ── Shopping list ─────────────────────────────────────────────────────────

  addToShoppingList: (name, inventoryId, targetQty = 1) => {
    const { house, shoppingList } = get();
    const exists = shoppingList.some(s =>
      (inventoryId && s.inventory_id === inventoryId) ||
      s.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) return;
    const item: ShoppingItem = {
      id: uid(), inventory_id: inventoryId, name, target_qty: targetQty, status: 'to_buy',
    };
    set(state => ({ shoppingList: [...state.shoppingList, item] }));
    if (house) sbInsert('shopping_list', { ...item, house_id: house.id });
  },

  adjustShoppingQty: (id, delta) => {
    const item = get().shoppingList.find(i => i.id === id);
    if (!item) return;
    const safeQty = Math.max(1, item.target_qty + delta);
    set(state => ({
      shoppingList: state.shoppingList.map(i =>
        i.id === id ? { ...i, target_qty: safeQty } : i
      ),
    }));
    sbUpdateDelayed('shopping_list', id, { target_qty: safeQty });
  },

  markAsPurchased: (id) => {
    set(state => ({
      shoppingList: state.shoppingList.map(i =>
        i.id === id ? { ...i, status: 'purchased' } : i
      ),
    }));
    sbUpdateDelayed('shopping_list', id, { status: 'purchased' });
  },

  unmarkPurchased: (id) => {
    set(state => ({
      shoppingList: state.shoppingList.map(i =>
        i.id === id ? { ...i, status: 'to_buy' } : i
      ),
    }));
    sbUpdateDelayed('shopping_list', id, { status: 'to_buy' });
  },

  removeFromShoppingList: (id) => {
    cancelDelayedUpdate('shopping_list', id);
    set(state => ({ shoppingList: state.shoppingList.filter(s => s.id !== id) }));
    sbDelete('shopping_list', id);
  },

  clearPurchased: () => {
    const purchased = get().shoppingList.filter(s => s.status === 'purchased');
    purchased.forEach(item => {
      cancelDelayedUpdate('shopping_list', item.id);
      sbDelete('shopping_list', item.id);
    });
    set(state => ({ shoppingList: state.shoppingList.filter(s => s.status !== 'purchased') }));
  },

  updatePantry: () => {
    const { shoppingList, inventory } = get();
    const purchased = shoppingList.filter(s => s.status === 'purchased');
    if (purchased.length === 0) return;
    const today     = new Date().toISOString();
    let   newInventory = [...inventory];
    const previousInventory = inventory.filter(inv => purchased.some(item => item.inventory_id === inv.id));
    const createdInventoryIds: string[] = [];

    purchased.forEach(item => {
      if (item.inventory_id) {
        newInventory = newInventory.map(inv =>
          inv.id === item.inventory_id
            ? { ...inv, qty: inv.qty + item.target_qty, last_restocked: today }
            : inv
        );
        sbUpdate('inventory', item.inventory_id, {
          qty: (newInventory.find(i => i.id === item.inventory_id)?.qty ?? 0),
          last_restocked: today,
        });
      } else {
        const newItem = { id: uid(), name: item.name, qty: item.target_qty, category: 'Other', last_restocked: today };
        newInventory.push(newItem);
        createdInventoryIds.push(newItem.id);
        const { house } = get();
        if (house) sbInsert('inventory', { ...newItem, house_id: house.id });
      }
      cancelDelayedUpdate('shopping_list', item.id);
      sbDelete('shopping_list', item.id);
    });

    set({
      inventory:    newInventory,
      shoppingList: shoppingList.filter(s => s.status !== 'purchased'),
      lastPantryUpdate: { items: purchased, previousInventory, createdInventoryIds },
    });
  },

  undoLastPantryUpdate: () => {
    const { lastPantryUpdate, house } = get();
    if (!lastPantryUpdate) return;

    const { items, previousInventory, createdInventoryIds } = lastPantryUpdate;
    let restoredInventory = get().inventory.filter(item => !createdInventoryIds.includes(item.id));
    previousInventory.forEach(previous => {
      restoredInventory = restoredInventory.map(item => item.id === previous.id ? previous : item);
      sbUpdate('inventory', previous.id, { qty: previous.qty, last_restocked: previous.last_restocked ?? null });
    });
    createdInventoryIds.forEach(id => sbDelete('inventory', id));
    if (house) {
      items.forEach(item => sbInsert('shopping_list', { ...item, house_id: house.id }));
    }

    set(state => ({
      inventory: restoredInventory,
      shoppingList: [...state.shoppingList, ...items],
      lastPantryUpdate: null,
    }));
  },

  // ── CSV import ────────────────────────────────────────────────────────────

  importCSV: (csvText) => {
    const rows = parseCSVRows(csvText);
    let added = 0, updated = 0;
    const { house } = get();

    set(state => {
      const newInventory = [...state.inventory];
      rows.forEach(row => {
        const idx = newInventory.findIndex(
          i => i.name.toLowerCase() === row.name.toLowerCase()
        );
        if (idx >= 0) {
          newInventory[idx] = { ...newInventory[idx], qty: newInventory[idx].qty + row.qty };
          sbUpdate('inventory', newInventory[idx].id, { qty: newInventory[idx].qty });
          updated++;
        } else {
          const newItem = { id: uid(), ...row };
          newInventory.push(newItem);
          if (house) sbInsert('inventory', { ...newItem, house_id: house.id });
          added++;
        }
      });
      return { inventory: newInventory };
    });

    return { added, updated };
  },
}));

// Persist the profile so a cold start can land in the app even with no network
// (loadSession falls back to this cache; clearSession wipes it).
useGleanStore.subscribe((state, prev) => {
  if (state.profile === prev.profile) return;
  if (state.profile) void saveProfile(state.profile);
  else void clearProfile();
});
