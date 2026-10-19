import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { healthRoute } from '@/routes/health';

export type AppOptions = {
  corsOrigin: string[];
};

/** The API is a stub for now: a health check behind CORS for the web app. */
export const createApp = ({ corsOrigin }: AppOptions) =>
  new Hono()
    .use('*', logger())
    .use('/api/*', cors({ origin: corsOrigin }))
    .route('/health', healthRoute)
    .notFound((c) => c.json({ error: 'Not found' }, 404));

export type App = ReturnType<typeof createApp>;
