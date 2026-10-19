// Shared types between @fo/web and @fo/core.
// Keep this package runtime-free: types and constants only.

export type HealthResponse = {
  name: string;
  status: 'ok';
  version: string;
  time: string;
};
