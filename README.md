# Private Teen Patti Arena - P2P Connection Fix

## Why "Connecting to host" gets stuck:
WebRTC peer-to-peer data channels require both devices to agree on ICE candidates. When connecting across different Wi-Fi routers, 5G/4G cellular networks, or behind NAT firewalls, standard STUN servers often fail without a full ICE configuration and an immediate handshake state reply.

## Applied Fixes:
1. **Multi-Region STUN Server Fallbacks**: Added Google and Twilio public STUN relay nodes (`stun:global.stun.twilio.com:3478`).
2. **Instant Handshake Sync**: When a client connects, the host immediately pushes a `STATE_UPDATE` handshake packet upon connection open, transitioning the client into the room lobby instantly.
3. **Connection Timeout Handling**: Added a 10-second connection timeout fallback to reset status if a network firewall blocks the PeerJS signal.

## How to Test & Deploy:
```bash
npm install
npm run build
```
Upload the contents of the `dist` folder to Netlify.
