export type ShortcutScope = "global" | "window" | "input" | "note";

export interface ShortcutEntry {
  name: string;
  keys: string;
  scope: ShortcutScope;
  action: string;
}
