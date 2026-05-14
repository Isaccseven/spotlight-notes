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

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `refactor:` code restructuring
- `chore:` maintenance tasks

## Questions?

Open a [discussion](https://github.com/Isaccseven/spotlight-notes/discussions) or an issue.
