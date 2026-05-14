import { load } from "@tauri-apps/plugin-store";
import { STORE_PATH, storeOptions } from "@/lib/store/config";

export const store = await load(STORE_PATH, storeOptions);
