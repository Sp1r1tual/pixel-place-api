# 🎨 Pixel Place (Api)

**Pixel Place** is an interactive online platform where users collaborate to create a massive pixel canvas — one pixel at a time. Inspired by projects like Reddit r/place, w/place, and other collective art experiments, it turns chaos and creativity into a living digital mosaic.

---

## 💡 Concept

**Pixel Place isn’t just a project — it’s a social experiment.** It’s about coexistence on a single canvas, where hundreds of users shape a shared digital world — sometimes chaotic, sometimes beautiful, always alive.

It’s pixel democracy: **each user gets one pixel, but together, they build art.**

---

## 🚀 Features

- 🧱 Live collaborative canvas — see others’ updates instantly via WebSockets
- 🔐 JWT authentication with refresh tokens
- 🎨 Color palette — choose from a curated set of colors
- 🔋 Energy system — each pixel placement consumes energy that regenerates over time
- 🌍 Multilingual UI (i18next) — automatic language detection and translations
- 💾 State management with Zustand — simple and performant global state
- 🧭 Modern routing — built on React Router v7

---

## 🛠️ Tech Stack

- **Runtime:** Node.js 22
- **Framework:** Express 5
- **Language:** TypeScript
- **Realtime Engine:** Socket.IO
- **Database Layer:** Supabase (PostgreSQL)
- **Authentication:** JSON Web Tokens (JWT + Refresh Tokens)
- **Validation:** express-validator
- **Security:** bcrypt, cookie-parser, CORS, dotenv
- **Mailing:** Nodemailer
- **Tooling:** ESLint, Prettier, Husky, lint-staged, Nodemon

📐 **Architecture**: Client ↔ Server ↔ Database

---

## 🌐 Future Plans

- 🧠 User accounts & profiles — persistent identities with avatars, personal stats, and contribution history; users can showcase their pixel art legacy.

- 💬 Global and community chat — real-time in-canvas chat for coordination, humor, and spontaneous chaos; with moderation and emoji support.

- 🏆 Leaderboard system — global ranking based on activity, precision, and contribution streaks; highlights top creators and pixel warriors.

- 🎁 Daily bonuses & streak rewards — log in daily to earn cooldown reductions, cosmetic effects, or limited-time colors.

- 🌐 Communities & factions — group up with friends, create art clans, and fight for your section of the canvas; optional shared color palettes and team banners.

- 📦 Pixel history & replay — full time-lapse playback of the canvas evolution; relive wars, alliances, and masterpieces.

- 🧱 Moderation tools — community-driven reporting and restoration systems to prevent vandalism and maintain fair play.

- 🪄 Seasonal events & limited challenges — themed canvases, world resets, or time-limited events that bring the community together in bursts of creativity.

- ⚡ And much more!

## 📜 License

MIT © 2025 — built with ❤️ by the Pixel Place community
