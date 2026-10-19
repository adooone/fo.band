import { indexRoute } from './index';
import { aboutRoute, concertsRoute, musicRoute } from './pages';
import { Root } from './root';

export const routeTree = Root.addChildren([
  indexRoute,
  musicRoute,
  concertsRoute,
  aboutRoute,
]);
