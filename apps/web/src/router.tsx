import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routes/route-tree';

const router = createRouter({ routeTree });

export default router;

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
