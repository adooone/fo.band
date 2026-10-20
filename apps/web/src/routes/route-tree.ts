import { indexRoute } from './index';
import { aboutRoute, findsRoute, musicRoute } from './pages';
import { Root } from './root';

export const routeTree = Root.addChildren([
  indexRoute,
  musicRoute,
  aboutRoute,
  findsRoute,
]);
