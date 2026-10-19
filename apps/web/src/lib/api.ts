import type { HealthResponse } from '@fo/types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3301';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return (await res.json()) as T;
};

export const api = {
  health: () => request<HealthResponse>('/health'),
};
