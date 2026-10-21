import * as SQLite from 'expo-sqlite';
import type { SQLiteBindValue } from 'expo-sqlite';
import { DDL } from './schema';
import type {
  House,
  InventoryItem,
  ShoppingItem,
  ConsumptionLog,
  HouseOption,
} from '../../store/useGleanStore';

const DB_NAME = 'glean.db';
const LAST_HOUSE_KEY = 'last_house_id';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(DDL);
      return db;
    });
  }
  return dbPromise;
}

// Insert a row, skipping undefined columns. Table name comes from a hardcoded
// caller, never user input.
function buildInsert(table: string, row: Record<string, unknown>): { sql: string; args: SQLiteBindValue[] } {
  const names = Object.keys(row).filter((k) => row[k] !== undefined);
  return {
    sql: `INSERT OR REPLACE INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
    args: names.map((k) => row[k] as SQLiteBindValue),
  };
}

export interface LocalHouseData {
  house: House;
  inventory: InventoryItem[];
  shoppingList: ShoppingItem[];
  consumptionLogs: ConsumptionLog[];
  houseOptions: HouseOption[];
}

/** Persist a full snapshot of one house's data (called after a Supabase fetch). */
export async function localSaveHouse(houseId: string, data: LocalHouseData): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM house WHERE id = ?', houseId);
    await db.runAsync('DELETE FROM inventory WHERE house_id = ?', houseId);
    await db.runAsync('DELETE FROM shopping_list WHERE house_id = ?', houseId);
    await db.runAsync('DELETE FROM consumption_logs WHERE house_id = ?', houseId);
    await db.runAsync('DELETE FROM house_options WHERE house_id = ?', houseId);

    const { members, ...houseRest } = data.house;
    const houseInsert = buildInsert('house', {
      ...houseRest,
      members_json: JSON.stringify(members ?? []),
    });
    await db.runAsync(houseInsert.sql, ...houseInsert.args);

    const bulk = async (table: string, rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        const { sql, args } = buildInsert(table, row);
        await db.runAsync(sql, ...args);
      }
    };
    await bulk('inventory', data.inventory as unknown as Record<string, unknown>[]);
    await bulk('shopping_list', data.shoppingList as unknown as Record<string, unknown>[]);
    await bulk('consumption_logs', data.consumptionLogs as unknown as Record<string, unknown>[]);
    await bulk('house_options', data.houseOptions as unknown as Record<string, unknown>[]);

    await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', LAST_HOUSE_KEY, houseId);
  });
}

/** Hydrate one house's data from the local cache, or null if it's not the last synced house. */
export async function localLoadHouse(houseId: string): Promise<LocalHouseData | null> {
  const db = await getDb();
  const last = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', LAST_HOUSE_KEY);
  if (last?.value !== houseId) return null;

  const houseRow = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM house WHERE id = ?', houseId);
  if (!houseRow) return null;

  const [inventory, shoppingList, consumptionLogs, houseOptions] = await Promise.all([
    db.getAllAsync<InventoryItem>('SELECT * FROM inventory WHERE house_id = ?', houseId),
    db.getAllAsync<ShoppingItem>('SELECT * FROM shopping_list WHERE house_id = ?', houseId),
    db.getAllAsync<ConsumptionLog>('SELECT * FROM consumption_logs WHERE house_id = ? ORDER BY consumed_at DESC', houseId),
    db.getAllAsync<HouseOption>('SELECT * FROM house_options WHERE house_id = ?', houseId),
  ]);

  const { members_json, ...rest } = houseRow;
  let members: House['members'] = [];
  try {
    members = members_json ? (JSON.parse(String(members_json)) as House['members']) : [];
  } catch {
    /* corrupt members blob — ignore */
  }

  return {
    house: { ...(rest as unknown as House), members },
    inventory,
    shoppingList,
    consumptionLogs,
    houseOptions,
  };
}

/** Drop all house-scoped rows (on sign-out / leave, so no cross-user leak). */
export async function localClearHouse(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM house;
      DELETE FROM inventory;
      DELETE FROM shopping_list;
      DELETE FROM consumption_logs;
      DELETE FROM house_options;
    `);
    await db.runAsync('DELETE FROM meta WHERE key = ?', LAST_HOUSE_KEY);
  });
}
