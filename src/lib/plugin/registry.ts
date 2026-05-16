import type { Plugin, PluginAPI } from "./types";

const plugins: { plugin: Plugin; uninstall?: () => void }[] = [];

export function registerPlugin(api: PluginAPI, plugin: Plugin): () => void {
  const uninstall = plugin.install(api);
  const entry = { plugin, uninstall: uninstall as (() => void) | undefined };
  plugins.push(entry);
  return () => {
    const idx = plugins.indexOf(entry);
    if (idx !== -1) {
      plugins[idx].uninstall?.();
      plugins.splice(idx, 1);
    }
  };
}

export function getRegisteredPlugins(): ReadonlyArray<Plugin> {
  return plugins.map((p) => p.plugin);
}

export function unregisterAllPlugins(): void {
  for (const p of plugins) {
    p.uninstall?.();
  }
  plugins.length = 0;
}
