import { Hono, type Context } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { serveStatic } from '@hono/node-server/serve-static';
import { secureHeaders } from 'hono/secure-headers';
import path from 'path';
import type { Track } from '@vizl/common/track.js';
import { Cache } from './utils/cache.js';
import { initializeLogger, getLogger } from './logger.js';
import {
  SoundcloudClient,
  ConcurrencyLimitedSoundcloudClient,
  CachedSoundcloudClient,
  type SoundcloudClientInterface,
} from './soundcloud.js';

interface ServerConfig {
  readonly port: number;
  readonly soundcloudClientId?: string;
  readonly soundcloudClientSecret?: string;
  readonly clientDistPath: string;
  readonly nodeEnv: 'development' | 'production' | 'test';
}

type Variables = {
  requestId: string;
};

const config: ServerConfig = {
  port: Number(process.env.PORT) || 8081,
  soundcloudClientId: process.env.SOUNDCLOUD_CLIENT_ID,
  soundcloudClientSecret: process.env.SOUNDCLOUD_CLIENT_SECRET,
  clientDistPath: process.env.CLIENT_DIST_PATH || path.resolve(process.cwd(), '../client/dist'),
  nodeEnv: (process.env.NODE_ENV as ServerConfig['nodeEnv']) || 'development',
};

initializeLogger(config.nodeEnv === 'development');
const logger = getLogger();

async function createSoundcloudClient(clientId?: string, clientSecret?: string): Promise<SoundcloudClientInterface> {
  if (!clientId || !clientSecret) {
    throw new Error('SoundCloud credentials not configured');
  }

  const rawClient = await SoundcloudClient.create({ clientId, clientSecret });
  const limitedClient = new ConcurrencyLimitedSoundcloudClient(rawClient, 10);
  const cache = new Cache<Track | null>(60 * 60 * 1000, 5 * 60 * 1000);
  return new CachedSoundcloudClient(limitedClient, cache);
}

const app = new Hono<{ Variables: Variables }>();

app.use('/api/*', async (c, next) => {
  const requestId: string = Math.random().toString(36).substring(2, 8);
  c.set('requestId', requestId);
  await next();
});

app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.get('requestId');

  logger.request(`<-- ${method} ${path}`, requestId);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  logger.request(`--> ${method} ${path} ${status} ${duration}ms`, requestId);
});

app.use('*', async (c, next) => {
  if (config.nodeEnv === 'production') {
    const proto = c.req.header('x-forwarded-proto');
    if (proto === 'http') {
      const host = c.req.header('host');
      const url = new URL(c.req.url);
      return c.redirect(`https://${host}${url.pathname}${url.search}`, 301);
    }
  }
  await next();
});

app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      scriptSrc: ["'self'"],
    },
  }),
);

app.use('*', compress());

if (config.nodeEnv === 'development') {
  app.use(
    '*',
    cors({
      origin: ['http://localhost:5173', 'https://localhost:5173'],
      credentials: true,
    }),
  );
}

app.use('/api/*', async (c, next) => {
  if (c.req.method === 'POST') {
    const contentType = c.req.header('content-type');
    if (contentType !== 'application/json') {
      return c.json(
        {
          error: 'Unsupported Media Type',
          message: 'Content-Type must be application/json for POST requests',
        },
        415,
      );
    }
  }
  await next();
});

app.get('/health', c => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'vizl-server',
  });
});

interface ResolveRequest {
  url: string;
}

const TRACK_NOT_FOUND = { message: 'Track not found' };

function isValidResolveRequest(body: unknown): body is ResolveRequest {
  return (
    typeof body === 'object' && body !== null && 'url' in body && typeof body.url === 'string' && body.url.trim() !== ''
  );
}

function createResolveHandler(client: SoundcloudClientInterface) {
  return async (c: Context<{ Variables: Variables }>) => {
    const requestId: string = c.get('requestId');

    try {
      const body: unknown = await c.req.json();

      if (!isValidResolveRequest(body)) {
        logger.request('Invalid request body', requestId);
        return c.json(TRACK_NOT_FOUND, 404);
      }

      const track: Track | null = await client.resolve(body.url.trim());

      if (!track) {
        logger.request('Track not found', requestId);
        return c.json(TRACK_NOT_FOUND, 404);
      }

      logger.request('Track resolved', requestId);
      return c.json(track);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(`Track resolution failed [${requestId}]: ${errorMessage}`);
      if (errorStack) {
        logger.error(`Stack trace [${requestId}]: ${errorStack}`);
      }

      return c.json(TRACK_NOT_FOUND, 404);
    }
  };
}

async function startServer(): Promise<void> {
  logger.app('='.repeat(50));
  logger.app('vizl server starting...');
  logger.app('='.repeat(50));
  logger.app(`port: ${config.port}`);
  logger.app(`environment: ${config.nodeEnv}`);
  logger.app(`client dist: ${config.clientDistPath}`);
  logger.app(`node version: ${process.version}`);
  logger.app(`platform: ${process.platform}`);

  const hasCredentials = !!(config.soundcloudClientId && config.soundcloudClientSecret);

  if (!hasCredentials) {
    logger.app('');
    logger.app('⚠️  WARNING: SoundCloud credentials not configured');
    logger.app('⚠️  Set SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET');
    logger.app('');
  }

  const client: SoundcloudClientInterface = await createSoundcloudClient(
    config.soundcloudClientId,
    config.soundcloudClientSecret,
  );

  app.post('/api/resolve', createResolveHandler(client));

  app.use(
    '/*',
    serveStatic({
      root: config.clientDistPath,
      index: 'index.html',
    }),
  );

  app.get(
    '*',
    serveStatic({
      path: path.join(config.clientDistPath, 'index.html'),
    }),
  );

  logger.app('='.repeat(50));

  const server = serve({
    fetch: app.fetch,
    port: config.port,
  });

  const shutdown = (signal: string): void => {
    logger.app(`Received ${signal}, shutting down gracefully...`);

    server.close(() => {
      logger.app('Server closed. Exiting process.');
      logger.flushSync();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      logger.flushSync();
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((error: unknown) => {
  logger.error('Failed to start server:', error);
  logger.flushSync();
  process.exit(1);
});
