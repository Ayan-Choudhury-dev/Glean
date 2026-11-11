export interface ScanResult {
  /** The decoded barcode value. */
  barcode: string;
  /** The symbology that produced it (e.g. "ean_13"). */
  format: string;
}

export interface PermissionStatus {
  camera: 'prompt' | 'granted' | 'denied';
}

export interface BarcodeScannerPlugin {
  /**
   * Open the camera and resolve with the first barcode scanned.
   *
   * @since 0.0.1
   */
  scan(): Promise<ScanResult>;

  /**
   * Report the current camera permission state.
   *
   * @since 0.0.1
   */
  checkPermissions(): Promise<PermissionStatus>;

  /**
   * Ask for camera permission.
   *
   * @since 0.0.1
   */
  requestPermissions(): Promise<PermissionStatus>;
}
