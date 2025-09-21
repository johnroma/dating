import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import Home from '@/app/page';

// Mock Next App Router hooks so client components render in tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('Home', () => {
  it('renders gallery heading', () => {
    const html = renderToString(<Home />);
    expect(html).toContain('Photo Gallery');
  });
});
