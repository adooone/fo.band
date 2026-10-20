import { createRoute } from '@tanstack/react-router';
import { SectionPage } from '@/features/sections/section-page';
import { Root } from './root';

const section = <const TPath extends string>(path: TPath, title: string) =>
  createRoute({
    getParentRoute: () => Root,
    path,
    component: () => <SectionPage title={title} />,
  });

export const musicRoute = section('/music', 'Music');
export const aboutRoute = section('/about', 'About');
export const findsRoute = section('/finds', 'Finds');
