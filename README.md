# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Carrier-Grade NAT (CGNAT) & Symmetric NAT Traversal**: Configures explicit multi-port TURN relays (UDP/TCP 80, 443, 3478) alongside ICE candidate pool prefetching and connection handshake retries so mobile data (Jio/Airtel) and restricted Wi-Fi networks connect reliably.
- **Host-Only Game Start Controls**: Only the host is permitted to start new games and hands.
- **Table Winner & Fresh Game Reset**: When all other players are spectating and only one player has chips left, that player is declared the Table Winner with an option to start a fresh game in the same room.
- **Mid-Game Leave Bot Prevention**: Leaving the room mid-game removes the player cleanly without spawning replacement bots.
- **Strict Room-Scoped Sessions & 2-Minute Threshold**: Joining a new room creates a fresh session; reloading the same room within 2 minutes preserves state and chips.
