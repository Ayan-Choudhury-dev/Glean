import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl      = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// AsyncStorage accesses `window` at import time, which crashes SSR.
// Only load it on native platforms or client-side web.
const getStorage = () => {
  if (Platform.OS !== 'web' || typeof window !== 'undefined') {
    const { default: AsyncStorage } = require('@react-native-async-storage/async-storage');
    return AsyncStorage;
  }
  return undefined;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:           getStorage(),
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: false,
  },
});
