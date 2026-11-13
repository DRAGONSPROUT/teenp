# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Custom Stake Validation & Enable/Disable**: Custom stake options (`$100`, `$200`, `$500`, `$1000`) are dynamically enabled only if they are at least equal to the required minimum bet under the Blind/Seen relative stake rules AND within the player's available chips.
- **Max Stake Chaal Value**: The Chaal value dynamically tracks and matches the highest active stake (`maxStakeAmount`).
- **Advanced Blind vs Seen Stake Logic**: Automatically calculates required matching stakes based on relative Blind/Seen status (`1x`, `2x`, or `0.5x`).
- **Spectator Mode for Low Chips**: Players with chips below the required stake or boot amount automatically enter spectator mode until a table winner emerges.
- **Robust Room Joining & Capacity Control**: Enforces human seat capacity checks while ignoring bots.
- **Persistent Session & Reconnection**: Retains chips, player state, and session tokens across browser page reloads.
