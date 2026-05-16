import { StoreOptions } from "@tauri-apps/plugin-store";

export const storeOptions: StoreOptions = {
  defaults: {},
  autoSave: true,
};

const STORAGE_KEY = "notes";
const SETTINGS_KEY = "settings";
const INTENT_SETTINGS_KEY = "intent-settings";
const STORE_PATH = `${STORAGE_KEY}.json`;
export const DEFAULT_TTL_HOURS = 24;
export { STORAGE_KEY, SETTINGS_KEY, INTENT_SETTINGS_KEY, STORE_PATH };
