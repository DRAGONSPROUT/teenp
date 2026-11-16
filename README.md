# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Winner Starts Next Hand & Spectating Host Fix**: The current round winner automatically takes the starting turn for the next hand. If the host is spectating, any active player or non-spectator host can successfully start the round without getting stuck.
- **Robust PeerJS Host Connection & STUN/TURN Retries**: Fixed guest joining failures by ensuring reliable PeerJS open and connection listeners with robust STUN/TURN server configurations.
- **Strict Room-Scoped Sessions & 2-Minute Threshold**: Joining a new room creates a fresh session for that room. Rejoining or reloading the same room within 2 minutes preserves state and chips.
- **Custom Stake Validation & Enable/Disable**: Custom stake options (`$100`, `$200`, `$500`, `$1000`) are dynamically enabled only if they meet or exceed the required minimum bet under the Blind/Seen relative stake rules AND are within the player's chips.
