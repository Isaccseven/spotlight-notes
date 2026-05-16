import type { ActionRoute, RouteCondition, RouteMatch } from "./types";
import type { Note } from "@/types/note";
import { parseTokens } from "@/lib/grammar";

let routes: ActionRoute[] = [];

export function registerRoute(route: ActionRoute): () => void {
  routes.push(route);
  return () => {
    const idx = routes.indexOf(route);
    if (idx !== -1) routes.splice(idx, 1);
  };
}

export function getRoutes(): ReadonlyArray<ActionRoute> {
  return routes;
}

export function clearRoutes(): void {
  routes = [];
}

export function setRouteEnabled(id: string, enabled: boolean): void {
  const route = routes.find((r) => r.id === id);
  if (route) route.enabled = enabled;
}

function evaluateCondition(note: Note, condition: RouteCondition): boolean {
  switch (condition.type) {
    case "hasToken": {
      const tokens = parseTokens(note.text);
      return tokens.some((t) => t.type === condition.tokenType);
    }
    case "matchesRegex": {
      return condition.pattern.test(note.text);
    }
    case "custom": {
      return condition.predicate(note);
    }
  }
}

export function matchRoutes(note: Note): Array<{ route: ActionRoute; match: RouteMatch }> {
  const tokens = parseTokens(note.text).map((t) => ({
    type: t.type,
    text: t.text,
  }));
  const match: RouteMatch = { note, tokens };

  const results: Array<{ route: ActionRoute; match: RouteMatch }> = [];
  for (const route of routes) {
    if (!route.enabled) continue;
    const allMatch = route.conditions.every((c) => evaluateCondition(note, c));
    if (allMatch) {
      results.push({ route, match });
    }
  }
  return results;
}

export async function runMatchedActions(note: Note): Promise<void> {
  const matched = matchRoutes(note);
  for (const { route, match } of matched) {
    try {
      await route.action(match);
    } catch (e) {
      console.error(`Action route "${route.name}" failed:`, e);
    }
  }
}
