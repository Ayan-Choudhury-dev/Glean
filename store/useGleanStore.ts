import { create } from 'zustand';
import { supabase } from '../lib/supabase';

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
}

export interface House {
  id:          string;
  name:        string;
  invite_code: string;
  member_ids:  string[];
}

export interface InventoryItem {
  id:             string;
  name:           string;
  qty:            number;
  category:       string;
  location?:      string;
  image_url?:     string;
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
}

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
  loading:         boolean;

  // Auth
  signUp:   (name: string, email: string, password: string) => Promise<string | null>;
  signIn:   (email: string, password: string)               => Promise<string | null>;
  signOut:  ()                                              => Promise<void>;
  loadSession: ()                                           => Promise<void>;

  // House
  createHouse: (name: string) => Promise<House | string>; // returns House or error string
  joinHouse:   (inviteCode: string) => Promise<boolean>;

  // Data sync: load everything from Supabase for the current house
  loadHouseData: (houseId: string) => Promise<void>;

  // Inventory
  updateQty:           (id: string, delta: number)                          => void;
  addInventoryItem:    (item: Omit<InventoryItem, 'id'>)                    => string;
  editInventoryItem:   (id: string, updates: Partial<Omit<InventoryItem, 'id'>>) => void;
  deleteInventoryItem: (id: string)                                         => void;

  // Consumption log
  logConsumption: (inventoryId: string, itemName: string, qty: number, action?: 'used' | 'restocked' | 'added') => void;

  // Shopping list
  addToShoppingList:   (name: string, inventoryId?: string, targetQty?: number) => void;
  updateShoppingQty:   (id: string, qty: number) => void;
  markAsPurchased:     (id: string) => void;
  unmarkPurchased:     (id: string) => void;
  updatePantry:        ()            => void;

  // CSV
  importCSV: (csvText: string) => { added: number; updated: number };
}

// ─── Supabase sync helpers (fire-and-forget) ──────────────────────────────────

function sbInsert(table: string, row: Record<string, unknown>) {
  supabase.from(table).insert(row).then(({ error }) => {
    if (error) console.error(`[sb] insert ${table}:`, error.message);
  });
}

function sbUpdate(table: string, id: string, updates: Record<string, unknown>) {
  supabase.from(table).update(updates).eq('id', id).then(({ error }) => {
    if (error) console.error(`[sb] update ${table}:`, error.message);
  });
}

function sbDelete(table: string, id: string) {
  supabase.from(table).delete().eq('id', id).then(({ error }) => {
    if (error) console.error(`[sb] delete ${table}:`, error.message);
  });
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ─── Dev seed data ────────────────────────────────────────────────────────────

const DEV_INVENTORY: InventoryItem[] = __DEV__ ? [
  { id: 'dev-1',  name: 'Whole Milk',        qty: 2,  category: 'Dairy',         location: 'Fridge'   },
  { id: 'dev-2',  name: 'Cheddar Cheese',    qty: 1,  category: 'Dairy',         location: 'Fridge'   },
  { id: 'dev-3',  name: 'Basmati Rice',      qty: 3,  category: 'Grains',        location: 'Pantry'   },
  { id: 'dev-4',  name: 'Atta',              qty: 1,  category: 'Grains',        location: 'Pantry'   },
  { id: 'dev-5',  name: 'Cumin Seeds',       qty: 1,  category: 'Spices',        location: 'Cupboard' },
  { id: 'dev-6',  name: 'Turmeric Powder',   qty: 2,  category: 'Spices',        location: 'Cupboard' },
  { id: 'dev-7',  name: 'Garam Masala',      qty: 1,  category: 'Spices',        location: 'Cupboard' },
  { id: 'dev-8',  name: 'Tomatoes',          qty: 5,  category: 'Vegetables',    location: 'Fridge'   },
  { id: 'dev-9',  name: 'Spinach',           qty: 1,  category: 'Vegetables',    location: 'Fridge'   },
  { id: 'dev-10', name: 'Onions',            qty: 4,  category: 'Vegetables',    location: 'Counter'  },
  { id: 'dev-11', name: 'Bananas',           qty: 6,  category: 'Fruits',        location: 'Counter'  },
  { id: 'dev-12', name: 'Apples',            qty: 4,  category: 'Fruits',        location: 'Fridge'   },
  { id: 'dev-13', name: 'Chicken Breast',    qty: 2,  category: 'Meat & Fish',   location: 'Freezer'  },
  { id: 'dev-14', name: 'Salmon Fillet',     qty: 1,  category: 'Meat & Fish',   location: 'Freezer'  },
  { id: 'dev-15', name: 'Orange Juice',      qty: 1,  category: 'Beverages',     location: 'Fridge'   },
  { id: 'dev-16', name: 'Green Tea',         qty: 1,  category: 'Beverages',     location: 'Cupboard' },
  { id: 'dev-17', name: 'Biscuits',          qty: 2,  category: 'Snacks',        location: 'Cupboard' },
  { id: 'dev-18', name: 'Mixed Nuts',        qty: 1,  category: 'Snacks',        location: 'Cupboard' },
] : [];

// ─── Dev seed consumption logs ────────────────────────────────────────────────

const DEV_LOGS: ConsumptionLog[] = __DEV__ ? [
  { id: 'log-1', inventory_id: 'dev-1', item_name: 'Whole Milk',      house_id: '', qty: 1, consumed_at: new Date(Date.now() - 2  * 3600000).toISOString() },
  { id: 'log-2', inventory_id: 'dev-1', item_name: 'Whole Milk',      house_id: '', qty: 2, consumed_at: new Date(Date.now() - 26 * 3600000).toISOString() },
  { id: 'log-3', inventory_id: 'dev-3', item_name: 'Basmati Rice',    house_id: '', qty: 1, consumed_at: new Date(Date.now() - 5  * 3600000).toISOString() },
  { id: 'log-4', inventory_id: 'dev-5', item_name: 'Cumin Seeds',     house_id: '', qty: 1, consumed_at: new Date(Date.now() - 3  * 86400000).toISOString() },
  { id: 'log-5', inventory_id: 'dev-8', item_name: 'Tomatoes',        house_id: '', qty: 3, consumed_at: new Date(Date.now() - 1  * 86400000).toISOString() },
] : [];

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGleanStore = create<GleanState>((set, get) => ({
  profile:         null,
  house:           null,
  inventory:       DEV_INVENTORY,
  shoppingList:    [],
  consumptionLogs: DEV_LOGS,
  loading:         false,

  // ── Auth ──────────────────────────────────────────────────────────────────

  signUp: async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) return error.message;
    if (!data.user) return 'Sign-up failed. Please try again.';

    // Profile is auto-created by DB trigger; update the name
    await supabase.from('profiles').update({ name }).eq('id', data.user.id);

    set({ profile: { id: data.user.id, name, house_id: null } });
    return null; // null = success
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!profile) return 'Profile not found.';

    set({ profile });

    if (profile.house_id) {
      await get().loadHouseData(profile.house_id);
    }

    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null, house: null, inventory: [], shoppingList: [], consumptionLogs: [] });
  },

  loadSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profile) {
      set({ profile });
      if (profile.house_id) await get().loadHouseData(profile.house_id);
    }
  },

  // ── House ─────────────────────────────────────────────────────────────────

  createHouse: async (name) => {
    const { profile } = get();
    if (!profile) return 'Not signed in.';

    const invite_code = generateInviteCode();
    const houseId     = uid();

    const { error } = await supabase
      .from('houses')
      .insert({ id: houseId, name, invite_code });

    if (error) return error.message;

    await supabase.from('profiles').update({ house_id: houseId }).eq('id', profile.id);

    const house: House = { id: houseId, name, invite_code, member_ids: [profile.id] };
    set({ house, profile: { ...profile, house_id: houseId } });
    return house;
  },

  joinHouse: async (inviteCode) => {
    const { profile } = get();
    if (!profile) return false;

    const { data: house } = await supabase
      .from('houses')
      .select('*')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single();

    if (!house) return false;

    await supabase.from('profiles').update({ house_id: house.id }).eq('id', profile.id);

    set({
      profile: { ...profile, house_id: house.id },
      house:   { ...house, member_ids: [] },
    });

    await get().loadHouseData(house.id);
    return true;
  },

  // ── Data loading ──────────────────────────────────────────────────────────

  loadHouseData: async (houseId) => {
    set({ loading: true });

    const [invRes, shopRes, logRes, houseRes] = await Promise.all([
      supabase.from('inventory').select('*').eq('house_id', houseId),
      supabase.from('shopping_list').select('*').eq('house_id', houseId),
      supabase.from('consumption_logs').select('*').eq('house_id', houseId),
      supabase.from('houses').select('*').eq('id', houseId).single(),
    ]);

    set({
      inventory:       invRes.data   ?? [],
      shoppingList:    shopRes.data  ?? [],
      consumptionLogs: logRes.data   ?? [],
      house:           houseRes.data ?? null,
      loading:         false,
    });
  },

  // ── Inventory ─────────────────────────────────────────────────────────────

  updateQty: (id, delta) => {
    set(state => ({
      inventory: state.inventory.map(item =>
        item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item
      ),
    }));
    const { inventory, house } = get();
    const item = inventory.find(i => i.id === id);
    if (item && house) sbUpdate('inventory', id, { qty: item.qty });
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
    };
    set(state => ({ consumptionLogs: [...state.consumptionLogs, log] }));
    if (profile?.house_id) sbInsert('consumption_logs', { ...log });
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

  updateShoppingQty: (id, qty) => {
    const safeQty = Math.max(1, qty);
    set(state => ({
      shoppingList: state.shoppingList.map(i =>
        i.id === id ? { ...i, target_qty: safeQty } : i
      ),
    }));
    sbUpdate('shopping_list', id, { target_qty: safeQty });
  },

  markAsPurchased: (id) => {
    set(state => ({
      shoppingList: state.shoppingList.map(i =>
        i.id === id ? { ...i, status: 'purchased' } : i
      ),
    }));
    sbUpdate('shopping_list', id, { status: 'purchased' });
  },

  unmarkPurchased: (id) => {
    set(state => ({
      shoppingList: state.shoppingList.map(i =>
        i.id === id ? { ...i, status: 'to_buy' } : i
      ),
    }));
    sbUpdate('shopping_list', id, { status: 'to_buy' });
  },

  updatePantry: () => {
    const { shoppingList, inventory } = get();
    const purchased = shoppingList.filter(s => s.status === 'purchased');
    const today     = new Date().toISOString();
    let   newInventory = [...inventory];

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
        const { house } = get();
        if (house) sbInsert('inventory', { ...newItem, house_id: house.id });
      }
      sbDelete('shopping_list', item.id);
    });

    set({
      inventory:    newInventory,
      shoppingList: shoppingList.filter(s => s.status !== 'purchased'),
    });
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
