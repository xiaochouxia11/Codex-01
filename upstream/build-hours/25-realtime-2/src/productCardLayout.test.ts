import { describe, expect, it } from 'vitest';
import css from './styles.css?raw';

describe('product card layout CSS', () => {
  it('allows product names to wrap instead of clipping them', () => {
    expect(css).not.toMatch(/\.product-title\s*{[^}]*-webkit-line-clamp/s);
    expect(css).not.toMatch(/\.product-title\s*{[^}]*overflow:\s*hidden/s);
  });
});
