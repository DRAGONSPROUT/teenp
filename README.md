# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Next-Turn All-In Showdown**: When a player makes a bid that reduces their total chips to 0, the current round continues so subsequent players can act or call Show; when the turn returns to that 0-chip player (or another player reaches 0 chips on their turn), the automatic showdown executes.
- **Seamless Network Disconnect Cleanup & Rejoin**: Active heartbeat pings and `conn.on('close')` / `beforeunload` handlers remove disconnected players immediately from the room and free their seat so they can rejoin without hitting a "Room is full" error.
- **Automatic NAT/TURN Escalation**: Automatic TURN relay escalation under the hood without cluttering the lobby UI.
