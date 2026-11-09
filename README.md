# Private Teen Patti Arena - Auto Disconnect & Connection Timeout Fix

## Fixed Issues:
1. **Auto Player Leave Detection**: When a player closes their browser, disconnects, or clicks "Leave Room", the host detects the connection drop instantly, removes them from the table, auto-advances the turn, and broadcasts an updated state to all clients.
2. **Eliminated Connection Timeout**: Upgraded WebRTC configuration with Metered TURN relay fallbacks and an increased ICE candidate pool (`iceCandidatePoolSize: 10`) so mobile/cellular network users bypass strict NAT firewalls without hanging on connection.
3. **Explicit Leave Room Option**: Added a top-bar "Leave" button so users can exit cleanly at any point.

## How to Test & Deploy:
```bash
npm install
npm run build
```
Upload the contents of the `dist` folder to Netlify.
