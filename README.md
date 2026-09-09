# Android Hello

A local-first Expo/React Native forum prototype. Profiles and posts persist on a
device; a small optional WebSocket host lets phones on the same Wi-Fi see the
same feed and Lobby chat.

## Share a forum on one Wi-Fi network

1. On one computer connected to the Wi-Fi, run `npm run lan-server`.
2. Find that computer's LAN IP address, for example `192.168.1.10`.
3. On each phone, open **Profile** in BestForums and enter
   `ws://192.168.1.10:3000`, then tap **Connect to LAN forum**.

The host saves shared data to `server/data.json`, which is intentionally ignored
by Git. This is a trusted-LAN demo only: it has no encryption, access control,
or Internet relay.

Features include anonymous or named posts, topics, sorting/filtering, media
spoilers, author deletion, four-profile deletion voting, optional GPS metadata,
time zones, a shake toggle, seed-code copying, and a Lobby chat.

## Run it on an Android phone

1. Install [Expo Go](https://expo.dev/go) from Google Play.
2. In this folder, install dependencies: `npm install`
3. Start the development server: `npm start`
4. With your phone on the same Wi-Fi network, scan the QR code from Expo Go.

If the phone cannot connect over the local network, run `npx expo start --tunnel` and scan the new QR code.

## Commands

- `npm start` — start Expo and show a QR code.
- `npm run android` — start Expo and open an attached Android device or emulator.
