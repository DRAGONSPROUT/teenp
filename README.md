# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Full-Mesh WebRTC Voice Chat**: All connected peers exchange audio streams directly with each other—so guests can hear both the host and all other guests.
- **Custom Stake Selection**: Players can choose stakes from $100, $200, $500, or $1000 during betting turns.
- **Chip Balance Guard**: Prevents players from placing bets exceeding their available chips.
- **Duplicate Session Cleanup**: Automatically deduplicates reconnecting players and cleanly removes disconnected sessions.
- **3-Player Default Lobby**: Defaults table seat selection to 3 players.

## Getting Started
1. Run `pnpm install`
2. Run `pnpm run dev`
