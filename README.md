# BestForums

A device-local Expo/React Native forum demo. It uses Expo SDK 54, which matches
the current Expo Go release distributed through Google Play.

Posts, local profiles, and votes persist on the current phone via device storage.
They are not shared with other devices. Create or switch local profiles to test
the four-profile vote-to-delete rule.

Features include anonymous or named posts, author-only deletion, optional GPS
coordinates with a reverse-geocoded place name, selectable display time zones,
and shake-to-jump-to-a-random-post.

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
