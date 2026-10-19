import '@testing-library/jest-dom/vitest';

// jsdom has no canvas; the rings renderer bails out when getContext returns null.
HTMLCanvasElement.prototype.getContext = (() => null) as never;

// jsdom does not implement scrolling; TanStack Router calls it on navigation.
window.scrollTo = (() => {}) as never;
