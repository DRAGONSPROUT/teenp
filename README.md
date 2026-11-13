# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Strict Room-Scoped Sessions & 2-Minute Threshold**: Joining a new room creates a fresh session for that room. Rejoining or reloading the same room within 2 minutes preserves state and chips, while inactive rooms or expired thresholds (>2 mins) reset.
- **Custom Stake Validation & Enable/Disable**: Custom stake options (`$100`, `$200`, `$500`, `$1000`) are dynamically enabled only if they meet or exceed the required minimum bet under the Blind/Seen relative stake rules AND are within the player's chips.
- **Max Stake Chaal Value**: The Chaal value dynamically tracks and matches the highest active stake (`maxStakeAmount`).
- **Spectator Mode for Low Chips**: Players with chips below the required stake or boot amount automatically enter spectator mode until a table winner emerges.
- **Robust Room Joining & Capacity Control**: Enforces human seat capacity checks while ignoring bots.
