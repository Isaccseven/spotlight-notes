# Contributing to Spotlight Notes

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Prerequisites**
   - [Bun](https://bun.sh) (package manager)
   - [Rust](https://rustup.rs) (nightly recommended)
   - macOS (the app uses macOS-specific APIs)

2. **Clone and install**
   ```bash
   git clone https://github.com/Isaccseven/spotlight-notes.git
   cd spotlight-notes
   bun install
   ```

3. **Run in development mode**
   ```bash
   bun run tauri dev
   ```

## Project Structure

```
src/              # React/TypeScript frontend
src-tauri/        # Rust/Tauri backend
src/components/   # UI components
src/lib/          # Store, shortcuts, logging, notifications
```

## Code Style

- TypeScript: strict mode, use types from `src/types/`
- Rust: follow `cargo fmt` conventions
- Components: prefer functional components with hooks
- CSS: use Tailwind utility classes

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes with clear messages
4. Ensure the app builds successfully (`bun run build` and `cargo build` in `src-tauri/`)
5. Open a pull request against `main`

## Commit Messages

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) via commitlint. Every commit message must follow the format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

The commit `type` determines the next version bump:

| Type     | Release | Description |
|----------|---------|-------------|
| `fix`    | Patch   | Bug fix |
| `feat`   | Minor   | New feature |
| `feat!` or `fix!` or `refactor!` etc. (`!` suffix) | Major | Breaking change |
| `docs`   | No release | Documentation only |
| `style`  | No release | Code style (formatting, semicolons, etc.) |
| `refactor` | No release | Code restructuring |
| `perf`   | No release | Performance improvement |
| `test`   | No release | Adding or fixing tests |
| `chore`  | No release | Maintenance tasks |
| `ci`     | No release | CI configuration changes |
| `build`  | No release | Build system changes |
| `revert` | No release | Revert a previous commit |

The `scope` is optional but recommended (e.g. `feat(store):`, `fix(tray):`).

Breaking changes use a `!` before the colon: `feat!(api): remove legacy endpoint`.

Examples:

```
feat(notifications): add @2d delay support
fix(store): handle empty notes gracefully
feat!: redesign persistence layer
docs: fix typo in README
```

## Questions?

Open a [discussion](https://github.com/Isaccseven/spotlight-notes/discussions) or an issue.
