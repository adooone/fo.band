import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { routeTree } from '@/routes/route-tree';

const renderAt = async (path: string) => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 });
};

const PAGES = [
  ['Музика', '/music'],
  ['Концерти', '/concerts'],
  ['Про нас', '/about'],
] as const;

describe('HomeShell', () => {
  it('links every section from the corners and the mobile nav', async () => {
    await renderAt('/');
    for (const [label, href] of PAGES) {
      const links = screen.getAllByRole('link', { name: label });
      expect(links).toHaveLength(2);
      for (const link of links) expect(link).toHaveAttribute('href', href);
    }
  });

  it('draws the trunk on a canvas', async () => {
    await renderAt('/');
    expect(document.querySelector('canvas')).not.toBeNull();
  });

  it('marks the open section and leads back home from it', async () => {
    await renderAt('/music');
    const links = screen.getAllByRole('link', { name: 'Музика' });
    for (const link of links) {
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link).toHaveAttribute('href', '/');
    }
  });
});
