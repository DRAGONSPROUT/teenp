# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Advanced Blind vs Seen Stake Logic**: Automatically calculates required matching stakes based on whether the reference max-stake player and current player are Blind or Seen (`1x`, `2x`, or `0.5x`).
- **Spectator Mode for Low Chips**: Players with chips below the required stake or boot amount automatically enter spectator mode until a table winner emerges.
- **Robust Room Joining & Capacity Control**: Fixes host connectivity barriers by reliably accepting incoming guest data connections and enforcing maximum human seat capacity checks (ignoring bots).
- **Persistent Session & Reconnection**: Retains chips, player state, and session tokens across browser page reloads without kicking players out.
