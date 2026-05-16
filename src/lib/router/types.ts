import type { Note } from "@/types/note";

export type RouteCondition =
  | { type: "hasToken"; tokenType: "issue" | "channel" | "tag" | "time" }
  | { type: "matchesRegex"; pattern: RegExp }
  | { type: "custom"; predicate: (note: Note) => boolean };

export interface RouteMatch {
  note: Note;
  tokens: Array<{ type: string; text: string }>;
}

export type RouteAction = (match: RouteMatch) => void | Promise<void>;

export interface ActionRoute {
  id: string;
  name: string;
  conditions: RouteCondition[];
  action: RouteAction;
  enabled: boolean;
}
