import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/**
 * Is this phone online, right now?
 *
 * Used for one thing: deciding whether "5 milk" might be a lie. If we are
 * offline, the number could be stale, so the UI says so instead of pretending.
 */

export interface NetState {
  /** null while the first check is still running. */
  online: boolean | null;
}

let listeners: ((online: boolean) => void)[] = [];
let current: boolean | null = null;

NetInfo.addEventListener(state => {
  current = Boolean(state.isConnected && state.isInternetReachable !== false);
  for (const listener of listeners) listener(current);
});

AppState.addEventListener('change', state => {
  if (state === 'active') {
    NetInfo.fetch().then(info => {
      current = Boolean(info.isConnected && info.isInternetReachable !== false);
      for (const listener of listeners) listener(current);
    });
  }
});

export function useOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(current);
  useEffect(() => {
    listeners.push(setOnline);
    NetInfo.fetch().then(info => setOnline(Boolean(info.isConnected && info.isInternetReachable !== false)));
    return () => {
      listeners = listeners.filter(l => l !== setOnline);
    };
  }, []);
  return online;
}
