import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ServerConfig } from './serverConfig';

// Dynamic Supabase client for a user-provided (self-hosted) backend. Null means
// the app is running local-only.

let client: SupabaseClient | null = null;

const getStorage = () => {
  if (Platform.OS !== 'web' || typeof window !== 'undefined') {
    return AsyncStorage;
  }
  return undefined;
};

/** The active self-hosted client, or null when running local-only. */
export function getSupabase(): SupabaseClient | null {
  return client;
}

/** Create and activate a client for the given self-hosted server. */
export function initSupabase(config: ServerConfig): SupabaseClient {
  client = createClient(config.url, config.anonKey, {
    auth: {
      storage: getStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export function clearSupabase(): void {
  client = null;
}

/** Lightweight connectivity check against a server config. */
export async function testConnection(config: ServerConfig): Promise<string | null> {
  try {
    const test = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await test.from('profiles').select('id').limit(1);
    if (error) return error.message;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
