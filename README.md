# ⚔️ West Marches Campaign Hub

A collaborative web app for managing a D&D West Marches campaign.

## Features
- 🧙 **Characters** — Create and manage your adventurers
- 🗺️ **Hex Map** — Interactive map with tagging
- 📍 **Locations** — Discovered places and landmarks
- 👤 **NPCs** — Known persons with details
- 🏛️ **Organizations** — Factions, guilds, and units
- 🎒 **Party Inventory** — Shared loot tracking
- 💬 **Comments** — Public and private annotations
- 👍 **Voting & Likes** — Community engagement
- 🔐 **Role-based Access** — Player / DM / Admin roles

## Tech Stack
- Vue 3 + TypeScript + Vite
- Tailwind CSS
- Firebase (Auth, Firestore, Hosting)
- Pinia for state management

## Setup
1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env` and fill in Firebase config
4. `npm run dev`

## Deployment
```bash
npm run build
firebase deploy
```
