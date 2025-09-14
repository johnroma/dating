import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

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

import Home from './page';

describe('Home', () => {
  it('renders gallery heading', () => {
    const html = renderToString(<Home />);
    expect(html).toContain('Photo Gallery');
  });
});
