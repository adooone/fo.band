import { createRoute } from '@tanstack/react-router';
import { SectionPage } from '@/features/sections/section-page';
import { Root } from './root';

const section = <const TPath extends string>(path: TPath, title: string) =>
  createRoute({
    getParentRoute: () => Root,
    path,
    component: () => <SectionPage title={title} />,
  });

export const musicRoute = section('/music', 'Музика');
export const concertsRoute = section('/concerts', 'Концерти');
export const aboutRoute = section('/about', 'Про нас');
