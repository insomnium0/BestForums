# Repository Guidelines

## Project Structure & Module Organization

BestForums is an Expo React Native client backed by a Node.js LAN server. The app entry point and primary screens/state live in `App.js`, with startup in `index.js`. The WebSocket, HTTP, authentication, and SQLite server is `server/index.js`. Expo configuration is in `app.json` and `eas.json`; native configuration helpers are in `plugins/`. User and hosting instructions live in `docs/`. Treat `dist/` as generated output and `server/` SQLite files and archives as runtime data; do not commit local databases, archives, or secrets.

## Build, Test, and Development Commands

- `npm install` installs the locked dependencies.
- `npm start` starts Expo Go for local development; scan its QR code in Expo Go.
- `npm run android` starts Expo and targets an attached Android device or emulator.
- `npm run lan-server` starts the Node 22.16+ LAN server on port 3000 by default.
- `npx expo start --tunnel` can help when the phone cannot reach the development server over Wi-Fi.

`package.json` does not currently define build, lint, or test scripts. There is no checked-in automated test suite; verify changes using the relevant app or server flow and describe any manual checks in the pull request.

## Coding Style & Naming Conventions

Follow the existing JavaScript style: two-space indentation, semicolons, single-quoted strings, and `camelCase` for variables and functions. Keep app UI and behavior consistent with existing React Native patterns in `App.js`; keep server persistence and transport changes in `server/index.js`. Use descriptive names and small, focused changes. No formatter or linter is configured, so review formatting against nearby code.

## Testing Guidelines

When changing client behavior, launch Expo and exercise the affected screen on a device or emulator. For server changes, run `npm run lan-server` with a local test client and check the relevant HTTP/WebSocket flow. Avoid using real user data in manual checks; the server stores state under `server/` by default. No coverage threshold or test naming scheme is established.

## Commit & Pull Request Guidelines

Recent commits use short, informal, sentence-style summaries (for example, “added pfps instead of the emojis”). Keep commit subjects concise and focused. Pull requests should explain the user-visible change, note relevant manual verification, link related issues when available, and include screenshots for UI changes. Call out configuration or data migration implications.

## Security & Configuration

Copy `.env.example` to `.env.local` for local Expo configuration and never commit `.env.local` or private credentials. `EXPO_PUBLIC_` values are bundled into the client and must not contain server secrets. Review `docs/LAPTOP_SERVER.md` before changing hosting, TLS, backup, or archive behavior.
