# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Automatic All-In Showdown at 0 Chips**: When a player's chips drop to 0 (or below the required next call), the round triggers an automatic showdown so their cards are evaluated instead of silently turning them into a spectator mid-hand. Players only enter spectator mode at the start of the next hand if they have insufficient chips for the boot.
- **Seamless Network Disconnect Cleanup & Rejoin**: Active heartbeat pings and `conn.on('close')` / `beforeunload` handlers remove disconnected players immediately from the room and free their seat so they can rejoin without hitting a "Room is full" error.
- **Automatic NAT/TURN Escalation (Clean UI)**: Removed the manual STUN/TURN toggle from the lobby while keeping automatic TURN relay escalation under the hood.
