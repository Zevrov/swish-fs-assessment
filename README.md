# Swish Analytics - Fullstack Assessment Setup

## Introduction

This skeleton project displays NBA player betting markets. **For assessment instructions, see [CANDIDATE_BRIEF.md](./CANDIDATE_BRIEF.md).**

## Setup Instructions

### Clone Repo

- Please clone this repo. Push completed code as a public repo on your personal Github account.

### Prerequisites

**Required Software:**

- **Node.js (v16 or higher)** - [Download here](https://nodejs.org/)
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
  - Make sure Docker Desktop is **running** before proceeding
  - On Windows: WSL 2 is recommended but not required (only if Docker Desktop prompts for it)

**Port Requirements:**

- Ports `3000`, `3001`, and `3306` must be available
- If you have MySQL running locally, stop it first: `brew services stop mysql` (macOS) or stop the MySQL service (Windows)

### Quick Start

```bash
# Single command setup (installs dependencies, starts Docker, runs migrations)
npm run setup

# Start the application
npm start

# Or in one command
npm run setup && npm start
```

The app will be available at:

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

## Submission

When you've completed the assessment and are ready to submit, please send us a link to the repo on _your personal Github account_ with your final changes.

## Project Structure

```
├── client/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API calls
│   │   └── types/          # TypeScript types
├── server/                 # Node.js + TypeScript backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── scripts/        # Database scripts
│   │   └── types/          # TypeScript types
└── database/              # SQL initialization and data files
    ├── init.sql
    ├── props.json
    └── alternates.json
```

## Troubleshooting

### Docker Issues

- **"Docker not found"**: Ensure Docker Desktop is installed and running
- **"Port 3306 already in use"**: Stop local MySQL:
  - macOS: `brew services stop mysql`
  - Windows: Stop MySQL service in Services app
  - Linux: `sudo systemctl stop mysql`
- **"Cannot connect to Docker daemon"**: Start Docker Desktop application
- **Container fails to start**: Try `npm run docker:down` then `npm run docker:up`

### Database Issues

- **"Connection refused"**: MySQL container is still initializing (setup script waits automatically up to 30 seconds)
- **"Seeding failed"**: Ensure `props.json` and `alternates.json` exist in `database/` folder
- **"Migration failed"**: Try `npm run docker:down && npm run docker:up` to reset database

### Port Conflicts

- **Frontend (3000) conflict**: Change port in `client/vite.config.ts`
- **Backend (3001) conflict**: Set `PORT=3002` in `.env` file
- **MySQL (3306) conflict**: Update `DB_PORT` in `.env` and `docker-compose.yml`

### General Issues

- **"Module not found"**: Run `npm run install:all` to install dependencies
- **TypeScript errors**: Check Node.js version (must be 16+)
- **Blank page**: Check browser console and network tab for errors
- **API not working**: Verify backend is running at http://localhost:3001/health

### Still Having Issues?

1. Try a clean restart: `npm run docker:down && npm run setup && npm start`
2. Check all prerequisites are installed and running
3. Verify no other services are using ports 3000, 3001, 3306

Good luck! 🏀
