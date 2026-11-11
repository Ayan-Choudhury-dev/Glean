import { WebPlugin } from '@capacitor/core';

import type { BarcodeScannerPlugin, PermissionStatus, ScanResult } from './definitions';

export class BarcodeScannerWeb extends WebPlugin implements BarcodeScannerPlugin {
  async scan(): Promise<ScanResult> {
    // The web app scans in-app with BarcodeDetector; this bridge is native-only.
    throw this.unavailable('Use the in-app scanner on the web.');
  }

  async checkPermissions(): Promise<PermissionStatus> {
    try {
      const p = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return { camera: p.state === 'granted' ? 'granted' : p.state === 'denied' ? 'denied' : 'prompt' };
    } catch {
      return { camera: 'prompt' };
    }
  }

  async requestPermissions(): Promise<PermissionStatus> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      return { camera: 'granted' };
    } catch {
      return { camera: 'denied' };
    }
  }
}
