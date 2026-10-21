import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { routeTree } from '@/routes/route-tree';

const renderAt = async (path: string) => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 });
  return view;
};

const PAGES = [
  ['Music', '/music'],
  ['About', '/about'],
  ['Art', '/art'],
] as const;

describe('HomeShell', () => {
  it('leads off to every section from the edges of the forest', async () => {
    await renderAt('/');
    for (const [label, href] of PAGES) {
      const link = screen.getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', href);
    }
  });

  it('names the band in the corner of the home page', async () => {
    await renderAt('/');
    // Once as the page's heading for assistive tech, once drawn in the corner.
    expect(screen.getAllByText('Forest Orchestra')).toHaveLength(2);
  });

  it('draws the forest on a canvas with the mark over it', async () => {
    await renderAt('/');
    expect(
      screen.getByRole('img', { name: 'The forest and the fo mark' }),
    ).toBeInTheDocument();
  });

  it('leads back to the forest from inside a section', async () => {
    for (const [, href] of PAGES) {
      const { unmount } = await renderAt(href);
      expect(screen.getByRole('link', { name: 'Forest' })).toHaveAttribute(
        'href',
        '/',
      );
      unmount();
    }
  });
});
