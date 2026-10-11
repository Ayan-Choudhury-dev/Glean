import { create } from 'zustand';

/**
 * Imperative overlay host — styled replacement for the native `Alert.alert`.
 *
 * `showDialog` renders a centred modal (confirm / info), `showMenu` renders a
 * bottom action sheet. Both are mounted once at the app root by `OverlayHost`.
 */

export type DialogConfig = {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** `null` renders a single-button dialog (info). Defaults to "Cancel". */
  cancelLabel?: string | null;
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
};

export type MenuOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  selected?: boolean;
};

export type MenuConfig = {
  title?: string;
  options: MenuOption[];
};

export type ToastConfig = {
  message: string;
};

interface OverlayState {
  dialog: DialogConfig | null;
  menu: MenuConfig | null;
  toast: ToastConfig | null;
  openDialog: (config: DialogConfig) => void;
  closeDialog: () => void;
  openMenu: (config: MenuConfig) => void;
  closeMenu: () => void;
  openToast: (config: ToastConfig) => void;
  closeToast: () => void;
}

export const useOverlay = create<OverlayState>(set => ({
  dialog: null,
  menu: null,
  toast: null,
  openDialog: dialog => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  openMenu: menu => set({ menu }),
  closeMenu: () => set({ menu: null }),
  openToast: toast => set({ toast }),
  closeToast: () => set({ toast: null }),
}));

export const showDialog = (config: DialogConfig) => useOverlay.getState().openDialog(config);
export const showMenu = (config: MenuConfig) => useOverlay.getState().openMenu(config);
/** Brief, non-blocking confirmation (e.g. "Copied to clipboard"). */
export const showToast = (message: string) => useOverlay.getState().openToast({ message });
