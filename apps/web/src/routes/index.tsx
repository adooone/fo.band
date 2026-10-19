import { createRoute } from '@tanstack/react-router';
import { HomePage } from '@/features/home';
import { Root } from './root';

export const indexRoute = createRoute({
  getParentRoute: () => Root,
  path: '/',
  component: HomePage,
});
