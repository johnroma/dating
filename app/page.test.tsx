import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import Home from './page';

describe('Home', () => {
  it('renders welcome text', () => {
    const html = renderToString(<Home />);
    expect(html).toContain('Welcome to Next.js!');
  });
});
