# BestForums

A local-first Expo/React Native forum prototype. Profiles and posts persist on a
device; a small optional WebSocket host lets phones on the same Wi-Fi see the
same feed and Lobby chat.

## Share a forum on one Wi-Fi network

1. On one computer connected to the Wi-Fi, run `npm run lan-server`.
2. Find that computer's LAN IP address, for example `192.168.1.10`.
3. On each phone, open **Profile** in BestForums and enter
   `ws://192.168.1.10:3000`, then tap **Connect to LAN forum**.

The host stores the complete shared history in `server/bestforums.sqlite` and
keeps phone sync light by sending only the most recent 80 posts and 150 chat
messages to each client. Older history remains in the server database. The old
`server/data.json` is automatically imported the first time the new server runs,
so existing LAN posts and chats are preserved.

Run the LAN server with Node.js 22.16 or newer:

```bash
npm run lan-server
```

### Archive LAN history

The server makes a SQLite archive at startup, once per day, and when it shuts
down cleanly. While connected, **Profile → CREATE & COPY LAN BACKUP LINK**
creates another snapshot and copies a download URL. Paste that URL into a
browser on the laptop running the server to download the `.sqlite` archive.
You can also list old snapshots at:

```text
http://YOUR_COMPUTER_IP:3000/archives
```

Archives are self-contained SQLite files: retain them in a separate backup
location, then open them later with a SQLite browser if needed. The server and
archive directory are intentionally ignored by Git. This remains a trusted-LAN
demo only: it has no encryption, access control, or Internet relay.

Features include named accounts and seed-only anonymous identities, topics,
sorting/filtering, media spoilers, author deletion, four-profile deletion
voting, optional GPS metadata, time zones, a shake toggle, and a Lobby chat.
The last signed-in account is restored on that device unless the person logs
out. This is local-demo authentication: named passwords live only in that
device's app storage, so a real public app needs a backend and secure auth.

## GIF search and performance testing

The Feed's **Performance test** generates 250 posts immediately. When connected
to the LAN host, it sends all 250 posts to the shared server, intentionally
stressing server writes, broadcasts, feed rendering, and local storage.

The Feed's GIF panel uses GIPHY. To enable it:

1. Create or sign in to a developer account at
   [GIPHY Developers](https://developers.giphy.com/dashboard/).
2. Create an API key in its dashboard.
3. Copy `.env.example` to `.env.local` and set
   `EXPO_PUBLIC_GIPHY_API_KEY=your_key`.
4. Restart Expo after saving the file.

GIPHY requires attribution; the app displays “Powered By GIPHY” below search
results. The key is included in the client app, so use a GIPHY client key and
monitor/restrict it in GIPHY's dashboard—never put a private server secret in
an `EXPO_PUBLIC_` variable or commit `.env.local`.

## Run it on an Android phone

1. Install [Expo Go](https://expo.dev/go) from Google Play.
2. In this folder, install dependencies: `npm install`
3. Start the development server: `npm start`
4. With your phone on the same Wi-Fi network, scan the QR code from Expo Go.

If the phone cannot connect over the local network, run `npx expo start --tunnel` and scan the new QR code.



## Commands

- `npm start` — start Expo and show a QR code.
- `npm run android` — start Expo and open an attached Android device or emulator.


### <ins> WORDS FROM ME, THE MAKER </ins>
Grievances (so far)
- text formatting is wonky, gonna make the text ACTUALLY fit on screen
- starting screen (the screen before the forum opens) is too bland and simple; planning on adding a custom pixel animation for the startup screen
- the app icon i just threw together in like 3 seconds in the middle of class, definitely going to revamp and make it actually interesting
- still haven't removed herobrine
