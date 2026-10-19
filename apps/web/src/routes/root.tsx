import { createRootRoute } from '@tanstack/react-router';
import { HomeShell } from '@/features/home/home-shell';

export const Root = createRootRoute({
  component: HomeShell,
});
