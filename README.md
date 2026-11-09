# Private Teen Patti Arena - On-Table Player UI Controls Update

## Changes Implemented:
1. **On-Table In-Game Action Options**: Removed the fixed bottom footer bar and placed action buttons (**See Card**, **Pack**, **Chaal**, **Side Show**, and **Show**) directly on the felt table, anchored below the player's own seat card/badge.
2. **P2P Connection & Peer Namespace**: Retained isolated room code logic and STUN fallback configuration for cross-device mobile joining on Netlify.

## How to Build & Deploy:
```bash
npm install
npm run build
```
Upload contents of `dist` folder to Netlify.
