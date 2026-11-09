# Private Teen Patti Arena - Online WebRTC Multiplayer Fix

## Resolved Features & Enhancements
1. **Multi-device Room Connection**: STUN/ICE signaling integration so friends on Netlify can join private room codes seamlessly across different networks.
2. **Custom Player Count & Smart Bot Auto-Fill**: Select between 3, 4, 5, or 6 maximum seats. Bots only fill the remaining empty seats when dealing a hand without creating bot overhead.
3. **Turn Synchronization**: State updates broadcast immediately on every action so all connected player screens update their turn indicator, pot amount, and active actions live.
4. **Side Show Option**: "Side Show" button allows seen players to request a hand comparison with the previous player during their turn.

## Quick Start Guide

```bash
npm install
npm run dev
```

## Build for Netlify / Web Hosting
```bash
npm run build
```
Upload contents of `dist` folder to Netlify.
