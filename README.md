# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Host-Only Game Start Controls**: Only the host is permitted to start new games and hands.
- **Table Winner & Fresh Game Reset**: When all other players are spectating and only one player has chips left, that player is declared the Table Winner with an option to start a fresh game in the same room.
- **Mid-Game Leave Bot Prevention**: Leaving the room mid-game no longer spawns unwanted replacement bots.
- **Enhanced PeerJS Cloud Signaling & STUN/TURN Connectivity**: Enhanced PeerJS server initialization options to guarantee robust cross-network room joining.
