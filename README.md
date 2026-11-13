# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Custom Stake Bidding & Reset**: Allows players to optionally select custom stakes ($100, $200, $500, $1000) or reset back to the standard Blind/Seen relative stake rules.
- **Advanced Blind vs Seen Stake Logic**: Automatically calculates required matching stakes based on relative Blind/Seen status (`1x`, `2x`, or `0.5x`).
- **Spectator Mode for Low Chips**: Players with chips below the required stake or boot amount automatically enter spectator mode until a table winner emerges.
- **Robust Room Joining & Capacity Control**: Enforces human seat capacity checks while ignoring bots, and prevents full-room overflows.
- **Persistent Session & Reconnection**: Retains chips, player state, and session tokens across browser page reloads without kicking players out.
