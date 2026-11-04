# Run BestForums from your laptop

BestForums now stores accounts, password hashes, sessions, posts, replies, profile avatars, lobby chat, and direct messages in `server/bestforums.sqlite`. That file is your persistent server data: keep it and back it up.

## 1. Run it on your home or school LAN

1. Install current Node.js LTS from <https://nodejs.org>.
2. In this project folder, run `npm install` once.
3. Start the server with `npm run lan-server`.
4. The server prints a BestForums QR code containing the laptop's LAN address. On every phone, tap **SCAN SERVER QR** on the sign-in screen and scan that code; then create an account and open **Local Communities** → **Connect to server**.
5. If scanning is unavailable, find the laptop's IPv4 Wi-Fi address (`ipconfig` on Windows, `ip addr` on Linux, or `ipconfig getifaddr en0` on macOS) and enter `ws://LAPTOP_IP:3000` manually.
6. Keep the laptop awake and permit Node.js through the private-network firewall when prompted. The server and every phone must use the same Wi-Fi/LAN; guest Wi-Fi often blocks device-to-device traffic.

Each account is saved in SQLite, so a person can log into that same account from another phone. Passwords are never stored in plaintext.

## 2. Let people connect over the Internet

The Expo QR code is only a way to install/open the development app. It does not make this laptop a public server. To make the server reachable outside the LAN:

1. Give the laptop a stable LAN IP using a DHCP reservation in your router.
2. Get a domain or Dynamic-DNS hostname and point it to your public IP.
3. Install Caddy on the laptop. Copy `deploy/Caddyfile.example` to Caddy's config location and replace `forum.example.com` with your hostname.
4. In the router, forward **only TCP 443** to the laptop. Do not forward port 3000.
5. Allow TCP 443 through the laptop firewall.
6. Start the forum with `BESTFORUMS_PUBLIC_URL=https://YOUR_HOSTNAME npm run lan-server`, then start/reload Caddy.
7. In the app, enter `wss://YOUR_HOSTNAME`, sign in, and connect. Test on cellular data rather than your home Wi-Fi.

Caddy supplies HTTPS and secure WebSockets automatically. If your ISP uses carrier-grade NAT or blocks inbound ports, ordinary port-forwarding will not work; use a VPS/VPN tunnel provider or host the server on a small cloud VM instead.

## 3. Keep it reliable

- Configure the laptop not to sleep while the server is needed.
- Start it at login using Task Scheduler (Windows), a systemd service (Linux), or a LaunchAgent (macOS).
- Copy `server/bestforums.sqlite` and the `server/archives/` folder to another drive regularly, with the server stopped for the safest manual copy.
- Keep Node.js, Caddy, and the operating system updated. Use a strong laptop login and do not share it.

## GIF search for app builds

GIF search needs a free GIPHY API key. Create one at <https://developers.giphy.com>, then set `EXPO_PUBLIC_GIPHY_API_KEY` in your EAS environment and make a new build. The app intentionally shows a clear prompt instead of embedding a shared secret when that key is absent.
