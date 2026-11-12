import { create } from 'zustand';
import { deleteItemImage } from '../lib/upload';
import {
  localSaveHouse,
  localLoadHouse,
  localClearHouse,
  localGetProfile,
  localSaveProfile,
  localClearProfile,
} from '../lib/db/client';
import { pushHouse, pullHouse } from '../lib/sync';
import { getServerConfig } from '../lib/serverConfig';
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
  /** ISO timestamp of the last successful push to the self-hosted server. */
  lastSyncedAt: string | null;
  lastPantryUpdate: {
    items: ShoppingItem[];
    previousInventory: InventoryItem[];
    createdInventoryIds: string[];
  } | null;

  // Auth
  signUp:   (name: string) => Promise<string | null>;
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
  /** Adopt a house pulled from the self-hosted server (restore). */
  adoptServerHouse: (houseId: string) => Promise<boolean>;
  /** Persist the local snapshot and push it to the connected server. */
  syncNow: () => Promise<void>;
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

// ─── Persistence (local-only) ─────────────────────────────────────────────────
// The store subscription at the bottom mirrors every change into SQLite, so the
// old Supabase write helpers are no-ops kept for call-site stability.

function reportSyncError(message: string) {
  try {
    useGleanStore.setState({ syncError: message });
  } catch {
    /* store not initialised yet */
  }
}

function sbInsert(_table: string, _row: Record<string, unknown>) {}
function sbUpdate(_table: string, _id: string, _updates: Record<string, unknown>) {}
function sbInsertConsumptionLog(_log: ConsumptionLog) {}
function sbUpdateDelayed(_table: string, _id: string, _updates: Record<string, unknown>) {}
function cancelDelayedUpdate(_table: string, _id: string) {}
function sbDelete(_table: string, _id: string) {}

// ─── Realtime (removed: local-only) ───────────────────────────────────────────

/** Keep only the newest RECENT_ACTIVITY_FETCH_LIMIT logs in memory. */
function capLogs(logs: ConsumptionLog[]): ConsumptionLog[] {
  if (logs.length <= RECENT_ACTIVITY_FETCH_LIMIT) return logs;
  return [...logs]
    .sort((a, b) => new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime())
    .slice(0, RECENT_ACTIVITY_FETCH_LIMIT);
}

function startRealtime(_houseId: string) {}
function stopRealtime() {}

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
  lastSyncedAt: null,
  lastPantryUpdate: null,

  // ── Auth ──────────────────────────────────────────────────────────────────

  signUp: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return 'Please enter your name.';
    const profile: Profile = { id: uid(), name: trimmed, house_id: null, avatar_url: null };
    await localSaveProfile(profile);
    set({ profile });
    return null;
  },

  signIn: async () => {
    const profile = await localGetProfile();
    if (!profile) return 'No local account yet.';
    set({ profile });
    if (profile.house_id) await get().loadHouseData(profile.house_id);
    return null;
  },

  signInWithMagicLink: async () => 'Not available in the local-only build.',
  sendPasswordReset: async () => 'Not available in the local-only build.',
  updatePassword: async () => 'Not available in the local-only build.',
  handleAuthRedirect: async () => {},

  signOut: async () => {
    get().clearSession();
  },

  clearSession: () => {
    stopRealtime();
    set({ profile: null, house: null, inventory: [], shoppingList: [], consumptionLogs: [], houseOptions: [], lastPantryUpdate: null });
    void localClearHouse();
    void localClearProfile();
  },

  clearSyncError: () => set({ syncError: null }),

  setAvatar: (url) => {
    const { profile } = get();
    if (!profile) return;
    const next = { ...profile, avatar_url: url };
    set({ profile: next });
    void localSaveProfile(next);
  },

  setName: (name) => {
    const { profile } = get();
    if (!profile) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile.name) return;
    const next = { ...profile, name: trimmed };
    set({ profile: next });
    void localSaveProfile(next);
  },

  loadSession: async () => {
    try {
      const profile = await localGetProfile();
      if (profile) {
        set({ profile });
        if (profile.house_id) await get().loadHouseData(profile.house_id);
      }
    } finally {
      set({ sessionLoaded: true });
    }
  },

  // ── House ─────────────────────────────────────────────────────────────────

  createHouse: async (name) => {
    const { profile } = get();
    const trimmed = name.trim();
    if (!profile) return 'No local profile.';
    if (!trimmed) return 'Please name your pantry.';

    const houseId = uid();
    const seededOptions = DEFAULT_HOUSE_OPTIONS.map(option => ({
      ...option,
      id: uid(),
      house_id: houseId,
      created_by: profile.id,
    }));
    const house: House = {
      id: houseId,
      name: trimmed,
      invite_code: '',
      owner_id: profile.id,
      image_key: null,
      members: [{ id: profile.id, name: profile.name, avatar_url: profile.avatar_url }],
    };
    const nextProfile = { ...profile, house_id: houseId };

    await localSaveProfile(nextProfile);
    await localSaveHouse(houseId, {
      house,
      inventory: [],
      shoppingList: [],
      consumptionLogs: [],
      houseOptions: seededOptions,
    });
    set({ house, profile: nextProfile, houseOptions: seededOptions });
    return house;
  },

  joinHouse: async () => false,

  setHouseImage: async (imageKey) => {
    const { house } = get();
    if (!house) return false;
    set(state => (state.house ? { house: { ...state.house, image_key: imageKey } } : {}));
    return true;
  },

  renameHouse: async (name) => {
    const { house } = get();
    const trimmed = name.trim();
    if (!house || !trimmed) return false;
    set(state => (state.house ? { house: { ...state.house, name: trimmed } } : {}));
    return true;
  },

  leaveHouse: async () => {
    const { profile } = get();
    if (!profile) return;
    stopRealtime();
    void localClearHouse();
    const nextProfile = { ...profile, house_id: null };
    void localSaveProfile(nextProfile);
    set({
      profile: nextProfile,
      house: null,
      inventory: [],
      shoppingList: [],
      consumptionLogs: [],
      houseOptions: [],
    });
  },

  removeMember: async () => {},

  refreshMembership: async () => {},

  // ── Data loading ──────────────────────────────────────────────────────────

  loadHouseData: async (houseId) => {
    // Make sure a queued write lands before we read, or a just-created pantry
    // reads back empty and gets wiped (see flushLocalSave).
    await flushLocalSave();
    const local = await localLoadHouse(houseId);
    if (local) {
      set({
        inventory: local.inventory,
        shoppingList: local.shoppingList,
        consumptionLogs: local.consumptionLogs,
        house: local.house,
        houseOptions: local.houseOptions,
        loading: false,
      });
    } else {
      set({ loading: false });
    }
  },

  adoptServerHouse: async (houseId) => {
    const { profile } = get();
    if (!profile) return false;
    const ok = await pullHouse(houseId);
    if (!ok) return false;
    const nextProfile = { ...profile, house_id: houseId };
    await localSaveProfile(nextProfile);
    set({ profile: nextProfile });
    await get().loadHouseData(houseId);
    return true;
  },

  syncNow: async () => {
    const s = get();
    if (!s.house) return;
    await localSaveHouse(s.house.id, {
      house: s.house,
      inventory: s.inventory,
      shoppingList: s.shoppingList,
      consumptionLogs: s.consumptionLogs,
      houseOptions: s.houseOptions,
    });
    await pushHouse(s.house.id);
    // pushHouse is a no-op without a configured server; only stamp the time
    // when there is somewhere it could have gone.
    if (await getServerConfig()) set({ lastSyncedAt: new Date().toISOString() });
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
    const { profile, house } = get();
    let itemName = '';
    set(state => {
      const item = state.inventory.find(i => i.id === id);
      if (item) itemName = item.name;
      return {
        inventory: state.inventory.map(i =>
          i.id === id ? { ...i, qty: i.qty + qty, last_restocked: new Date().toISOString() } : i
        ),
      };
    });
    if (house) {
      const log: ConsumptionLog = {
        id: uid(),
        inventory_id: id,
        item_name: itemName,
        house_id: house.id,
        consumed_at: new Date().toISOString(),
        qty,
        action: 'restocked',
        user_id: profile?.id ?? null,
      };
      set(state => ({ consumptionLogs: capLogs([...state.consumptionLogs, log]) }));
    }
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
    // Remove the stored local image so it doesn't orphan.
    const { house } = get();
    if (house) void deleteItemImage(house.id, id);
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

// ─── Local mirror (write-through) ─────────────────────────────────────────────
// Persist house data to SQLite whenever it changes, debounced so rapid edits
// (e.g. the qty stepper) collapse into one snapshot. Read latest state at flush
// time so a sign-out/leave that already cleared the DB is never resurrected.
let localSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** Write the current house snapshot to SQLite now. */
async function persistNow(): Promise<void> {
  const s = useGleanStore.getState();
  if (!s.house) return;
  const houseId = s.house.id;
  await localSaveHouse(houseId, {
    house: s.house,
    inventory: s.inventory,
    shoppingList: s.shoppingList,
    consumptionLogs: s.consumptionLogs,
    houseOptions: s.houseOptions,
  });
  void pushHouse(houseId);
}

function scheduleLocalSave() {
  if (localSaveTimer) clearTimeout(localSaveTimer);
  localSaveTimer = setTimeout(() => {
    localSaveTimer = null;
    void persistNow();
  }, 300);
}

/**
 * Cancel the debounce and write immediately.
 *
 * Anything that reads from disk has to call this first: onboarding creates the
 * house and its staples, then navigates; the pantry's loadHouseData would
 * otherwise read a database that is still 300ms behind, replace the fresh
 * items with an empty list, and let the debounced flush persist the emptiness.
 */
export async function flushLocalSave(): Promise<void> {
  if (!localSaveTimer) return;
  clearTimeout(localSaveTimer);
  localSaveTimer = null;
  await persistNow();
}

useGleanStore.subscribe((state, prev) => {
  const changed =
    state.house !== prev.house ||
    state.inventory !== prev.inventory ||
    state.shoppingList !== prev.shoppingList ||
    state.consumptionLogs !== prev.consumptionLogs ||
    state.houseOptions !== prev.houseOptions;
  if (!changed || !state.house) return;
  scheduleLocalSave();
});
