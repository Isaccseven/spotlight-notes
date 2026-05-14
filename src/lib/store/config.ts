import { StoreOptions } from "@tauri-apps/plugin-store";

export const storeOptions: StoreOptions = {
  defaults: {},
  autoSave: true,
};

const STORAGE_KEY = "notes";
const STORE_PATH = `${STORAGE_KEY}.json`;
export { STORAGE_KEY, STORE_PATH };
