# BestForums

For the persistent laptop-server setup (LAN, Internet, TLS, backups, and GIF-key setup), see [docs/LAPTOP_SERVER.md](docs/LAPTOP_SERVER.md).

A React Native forum with a Node/SQLite server. Accounts, posts, replies,
profile avatars, Lobby chat, and direct messages persist on the server.

## Share a forum on one Wi-Fi network

1. On one computer connected to the Wi-Fi, run `npm run lan-server`.
2. The terminal prints a BestForums server QR code. On each phone, tap
   **SCAN SERVER QR** on the sign-in screen and scan it; the server address is
   filled in automatically.
3. Create an account, then open **Local Communities** and tap **Connect to server**.

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

The server makes a complete SQLite archive at startup, once per day, and when it
shuts down cleanly. While connected, **Profile → ARCHIVE LAN CHAT & FORUM**
also creates a readable `.chat.json` transcript of every archived LAN chat.
Both download URLs are copied to the clipboard. Paste them into a browser on
the computer running the server (or another device on that Wi-Fi) to download
them. The SQLite file contains the complete forum and chat database; the JSON
file is convenient for reading or importing chat history. You can also list old
snapshots at:

```text
http://YOUR_COMPUTER_IP:3000/archives
```

Archives are self-contained SQLite files: retain them in a separate backup
location, then open them later with a SQLite browser if needed. The server and
archive directory are intentionally ignored by Git. For encrypted Internet
access with `wss://`, Caddy, Dynamic DNS, router setup, and backups, follow
[docs/LAPTOP_SERVER.md](docs/LAPTOP_SERVER.md).

Passwords are hashed on the server; sessions are stored securely on each phone.
The last signed-in account is restored unless the person logs out.

## GIF search

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
