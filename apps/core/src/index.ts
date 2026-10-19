import { createApp } from '@/app';
import { env } from '@/env';

const app = createApp({ corsOrigin: env.CORS_ORIGIN });

console.log(`@fo/core listening on http://localhost:${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
