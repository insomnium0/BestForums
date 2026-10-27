# Hosting BestForums from this computer

The Node server listens on port 3000 for the local network. For Internet users, place Caddy in front of it so phones use `wss://` and HTTPS.

1. Register a domain or create a Dynamic-DNS hostname.
2. Point its DNS A/AAAA record at this network's public IP.
3. Reserve this computer's LAN IP in the router.
4. Forward only TCP 443 from the router to this computer. Do **not** forward port 3000.
5. Install Caddy on this computer, copy `deploy/Caddyfile.example` to its Caddy configuration location, and replace the placeholder hostname.
6. Start BestForums with `BESTFORUMS_PUBLIC_URL=https://YOUR_DOMAIN npm run lan-server`.
7. Start/reload Caddy. Caddy obtains and renews the TLS certificate; it proxies WebSocket traffic too.
8. Internet users connect with `wss://YOUR_DOMAIN`; LAN users can keep using `ws://YOUR_COMPUTER_LAN_IP:3000`.

Keep the computer powered on, prevent sleep, and keep Node/Caddy updated. The server now requires an account before a WebSocket can read or change forum data.
