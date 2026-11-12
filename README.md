# Private Teen Patti Web Application

A full-featured, private multiplayer Teen Patti web application built with React, PeerJS (WebRTC), and Tailwind CSS.

## Features
- **Full-Mesh WebRTC Voice Chat**: All connected peers exchange audio streams directly with each other—so guests can hear both the host and all other guests.
- **Exact Custom Stake Selection & Reset**:
  - When no custom stake option is chosen, Seen players pay `2x` the table base stake (`currentStake * 2`) and Blind players pay `1x` (`currentStake`).
  - When a custom stake (`$100`, `$200`, `$500`, or `$1000`) is selected, the bet amount uses that exact value as-is without doubling, even after seeing cards.
  - Includes a **Reset** button to clear any custom stake selection back to default table stake rules.
- **Chip Balance Guard**: Prevents players from placing bets exceeding their available chips.
- **Duplicate Session Cleanup**: Automatically deduplicates reconnecting players and cleanly removes disconnected sessions.

## Getting Started
1. Run `pnpm install`
2. Run `pnpm run dev`
