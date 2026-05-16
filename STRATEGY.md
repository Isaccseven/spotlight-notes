---
name: Spotlight Notes
last_updated: 2026-05-15
---

# Spotlight Notes Strategy

## Target problem

Developers are in the middle of meetings or deep in flow and need to quickly capture a note or reminder without opening a heavy app, losing mental context, or breaking eye contact.

## Our approach

Capture-first, zero-friction — keyboard-only from trigger to save, with inline syntax handling both content and scheduling in one shot.

## Who it's for

**Primary:** Developers deep in flow — They're hiring Spotlight Notes to log a one-liner without leaving the editor or breaking mental context.

## Key metrics

- **Notes captured per active user per day** — Average notes created by daily active users; measured via store events or telemetry
- **Capture-to-save time** — Time from `Cmd+Shift+W` to persisted note; measured via app instrumentation
- **Daily shortcut usage rate** — % of installed users who trigger the shortcut at least once per day; measured via shortcut event logs
- **Reminder completion rate** — % of `@time` reminders where the user re-opens the app to act; measured via notification interaction events
- **Repeat capture rate** — % of sessions with 2+ notes captured; measured via session telemetry

## Tracks

### Zero-friction capture

The core interaction loop: global shortcut latency, overlay open/close speed, keyboard-only navigation, auto-save, and keeping the app invisible in the Dock.

_Why it serves the approach:_ Every millisecond of friction kills the "just appears" feeling.

### Inline action syntax

Expanding what a single typed line can express: `@time` reminders today, `#tags` tomorrow, maybe `@channel` or `@issue` later.

_Why it serves the approach:_ Every token removes a need for UI chrome or a second app.

### Always-available reliability

Cold start under 500ms, tray icon stable across sleep/wake, notification delivery guaranteed, data never lost.

_Why it serves the approach:_ Developers won't trust external memory if it flakes.

### Developer ecosystem fit

Integrations with VS Code, terminal, GitHub — wherever developers already are.

_Why it serves the approach:_ The less distance between thought and capture, the more it's used.
