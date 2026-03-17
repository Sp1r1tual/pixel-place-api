# Pixel Place (Main API)

**Pixel Place** is an interactive online platform where users collaborate to create a massive pixel canvas – one pixel at a time. Inspired by projects like [Reddit r/place](https://www.reddit.com/r/place/), [w/place](https://wplace.live/), and other collective art experiments, it turns chaos and creativity into a living digital mosaic.

---

## Concept

**Pixel Place isn’t just a project – it’s a social experiment.** It’s about coexistence on a single canvas, where hundreds of users shape a shared digital world – sometimes chaotic, sometimes beautiful, always alive.

It’s pixel democracy: **each user gets one pixel, but together, they build art.**

---

## Screenshot

![Pixel Place](https://res.cloudinary.com/dynnapuco/image/upload/v1767999836/54f27db0-66c9-40ee-9101-40b59f422749.png)

---

## About the Project

This is the author’s second full-fledged project, and the MVP was built in just 10 days. The project allowed the author to practice WebSockets, real-time collaboration, and state synchronization. Ever since starting programming, the author dreamed of creating a project like this – a digital canvas shaped by lot of users simultaneously.

---

## Features

- 🧱 Live collaborative canvas – see others’ updates instantly via WebSockets
- 🔐 JWT authentication – secure login, account activation via email, and password recovery
- 🎨 Color palette – choose from a curated set of colors
- 🔍 Pixel info – view details about each pixel on the canvas
- 🔋 Energy system – each pixel placement consumes energy that regenerates over time
- 👩‍🦰 User profiles – displaying statistics and users avatars
- 🪙 Shop – users have the ability to purchase upgrades with in-game currency
- 🌍 Localization – support for three languages to reach a wider audience

---

## Tech Stack

- TypeScript
- Express
- Socket.IO
- Axios
- Supabase
- JSON Web Tokens
- Multer Storage Cloudinary

**Architecture**: Client ↔ (Main API - Mail API) ↔ Database

---

## Future Plans

- **Leaderboard system** – global ranking based on activity, precision, and contribution streaks; highlights top creators and pixel warriors.

- **Daily bonuses & streak rewards** – log in daily to earn cooldown reductions, cosmetic effects, or limited-time colors.

- **Moderation tools** – community-driven reporting and restoration systems to prevent vandalism and maintain fair play.

- **Seasonal events & limited challenges** – themed canvases, world resets, or time-limited events that bring the community together in bursts of creativity.

- **Complete documentation** – provide full and detailed documentation for the service

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/Sp1r1tual/pixel-place-api.git
```

### Mail Service

This project requires a separate mail service. Clone and set it up first by following the instructions in its repository:

```bash
git clone https://github.com/Sp1r1tual/mail-api.git
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```dotenv
PORT=5000
CLIENT_URL=http://localhost:5173
API_URL=http://localhost:5000

# Supabase — create a project at https://supabase.com
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Cloudinary — create a free account at https://cloudinary.com
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# JWT
JWT_ACCESS_SECRET=your_jwt_access_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_RESET_SECRET=your_jwt_reset_secret

# Mail Service URL (from the mail-api repository)
MAIL_SERVICE_URL=http://localhost:10000
```

### 4. Set up the database

Log in to Supabase CLI and push migrations to your project:

```bash
npm run supabase:login
npm run db:setup
```

> `db:setup` links your local project to the remote Supabase instance and pushes all migrations.

### 5. Start the server

```bash
yarn dev
```

The server will be available at `http://localhost:5000`.

---

## License

Currently, this project does not include a formal license. All rights are reserved by the author.

If you plan to use, modify, or distribute this project, please contact the author for permission.

Built with ❤️ by the Pixel Place community
