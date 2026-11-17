# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Persistent Room Ledger (Name & Chip Balance Across Leave/Rejoin)**: Both the host and client maintain a room-scoped ledger (`localStorage` + host `roomLedgerRef`) keyed by persistent `sessionId` and normalized player name, so leaving a room and rejoining later restores the player's exact chip balance and name without resetting to $5000 or "Player 1".
- **Next-Turn All-In Showdown**: When a player makes a bid that reduces their total chips to 0, the current round continues so subsequent players can act or call Show; when the turn returns to that 0-chip player, the automatic showdown executes.
- **Seamless Network Disconnect Cleanup & Rejoin**: Active heartbeat pings and `conn.on('close')` / `beforeunload` handlers remove disconnected players immediately from the room and free their seat so they can rejoin without hitting a "Room is full" error.
