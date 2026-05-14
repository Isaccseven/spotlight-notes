<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/2c4d7b0e-8c00-4b09-a1bf-9e5d2f9ffb71">
  <img src="https://github.com/user-attachments/assets/fc8b8c60-9f95-4e14-af34-7a1fdb1c5eec" alt="Spotlight Notes banner" width="100%">
</picture>

# Spotlight Notes

> A macOS menu-bar quick-note app with a Spotlight-like overlay and scheduled reminders.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri-FFC131)](https://v2.tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-1.85-000000)](https://www.rust-lang.org)

## Features

- **Spotlight-like overlay** — Clean, centered input panel activated by global shortcut
- **Instant save** — Notes persist automatically via Tauri's plugin-store
- **Scheduled reminders** — Type `@30s`, `@5m`, `@1h`, or `@2d` in your note to get a native notification
- **Keyboard-first** — Tab between notes, delete with Backspace, Escape to dismiss
- **System tray** — Lives in your menu bar with no Dock icon (macOS ActivationPolicy Accessory)
- **Global shortcut** — `Cmd+Shift+W` toggles the overlay from anywhere
- **Syntax highlighting** — Delay tokens are colorized inline

## Demo

https://github.com/user-attachments/assets/f0ef7f45-6e27-4f1a-a5a4-5e1e72c48f63

## Installation

### Download

Grab the latest release from the [Releases page](https://github.com/Isaccseven/spotlight-notes/releases).

### Build from source

```bash
# Prerequisites: Bun, Rust
git clone https://github.com/Isaccseven/spotlight-notes.git
cd spotlight-notes
bun install
bun run tauri build
```

The built app will be in `src-tauri/target/release/bundle/`.

## Usage

| Action | Input |
|--------|-------|
| Show/Hide overlay | `Cmd+Shift+W` or click tray icon |
| Save note | Type and press Enter / click away |
| Schedule reminder | Include `@30s`, `@5m`, `@1h`, or `@2d` in your note |
| Delete a note | Press `Backspace` when focused on it |
| Navigate notes | `Tab` / `Shift+Tab` |
| Dismiss overlay | `Escape` (twice to hide) |
| Quit | Right-click tray icon → Quit |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | [Tauri v2](https://v2.tauri.app) |
| Frontend | React 19, TypeScript 5.8 |
| Styling | Tailwind CSS v4 |
| Build | Vite 7, Bun |
| Backend | Rust (edition 2021) |
| Persistence | `@tauri-apps/plugin-store` |
| Notifications | `@tauri-apps/plugin-notification` |

## Development

```bash
bun run tauri dev      # Start dev server with hot-reload
bun run build          # TypeScript check + Vite build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed setup and contribution guidelines.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
