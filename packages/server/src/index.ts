import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { Track } from '@vizl/shared';

const app = new Hono();

// health check endpoint
app.get('/health', c => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'vizl-server',
  });
});

// example endpoint that uses shared types
app.get('/api/example', c => {
  // example track using shared type to verify cross-package imports work
  const exampleTrack: Track = {
    streamUrl: 'https://example.com/stream',
    url: 'https://soundcloud.com/example',
    title: 'Example Track',
    artwork: null,
    user: {
      name: 'Example User',
      profile: 'https://soundcloud.com/example-user',
    },
  };

  return c.json({ track: exampleTrack });
});

const port = Number(process.env.PORT) || 8081;

console.log(`Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
