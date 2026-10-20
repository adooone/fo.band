import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { type Edge, pathToward } from './links';

const KEYS: Record<string, Edge> = {
  ArrowRight: 'right',
  ArrowLeft: 'left',
  ArrowDown: 'bottom',
  ArrowUp: 'top',
};

/**
 * Walks the forest with the arrow keys and with swipes: a swipe to the left
 * goes right, as if pulling the forest along; Escape goes home.
 */
export const useDirections = () => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const go = (edge: Edge) => {
      const to = pathToward(pathRef.current, edge);
      if (to) navigate({ to });
    };
    const typing = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      target.closest('input, textarea, select, [contenteditable]') !== null;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      if (e.key === 'Escape' && pathRef.current !== '/') {
        navigate({ to: '/' });
        return;
      }
      const edge = KEYS[e.key];
      if (!edge) return;
      e.preventDefault();
      go(edge);
    };
    let start: { x: number; y: number; id: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || typing(e.target)) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const onUp = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      const far = Math.max(
        60,
        0.12 * Math.min(window.innerWidth, window.innerHeight),
      );
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > far) {
        go(dx < 0 ? 'right' : 'left');
      } else if (Math.abs(dy) > far) {
        go(dy < 0 ? 'bottom' : 'top');
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, [navigate]);
};
