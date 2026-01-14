# vizl

[![checks](https://github.com/anirbanmu/vizl/actions/workflows/checks.yml/badge.svg)](https://github.com/anirbanmu/vizl/actions/workflows/checks.yml)

A WebGL 2 based music visualizer.

## Tech Stack

- **Frontend**: Svelte 5, Vite, WebGL 2
- **Backend**: Hono, Node.js, TypeScript

## Prerequisites

- **Node.js**: v22 or higher
- **npm**: (packaged with Node.js)

## Environment Variables

You need to set up your environment variables for the server. Copy `.env.example` to `.env.local` and fill in your SoundCloud credentials.

```bash
cp .env.example .env.local
```

Required variables:
- `SOUNDCLOUD_CLIENT_ID`
- `SOUNDCLOUD_CLIENT_SECRET`

## Setup

Install dependencies from the root directory:

```bash
npm install
```

## Development

Start both the client and server in development mode:

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:8081

## Build

Build both packages:

```bash
npm run build
```

## Docker

You can also run `vizl` using Docker.

```bash
# Production build
docker build -t vizl .
docker run -p 3000:3000 --env-file .env.local vizl
```

## Notes

> [!NOTE]
> This is a complete rewrite. The legacy code is unmaintained and lives in the [`legacy`](https://github.com/anirbanmu/vizl/tree/legacy) branch.
