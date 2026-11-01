import { describe, expect, it } from 'vitest';

import { buildFilterHighlightTargets, getProductRecommendationRank } from './recommendationHighlights';

const visibleProducts = [
  { target: 'product-tent-green' },
  { target: 'product-tent-shade' },
  { target: 'product-tent-emergency' },
];

describe('recommendation highlight helpers', () => {
  it('keeps the changed control and adds the first two visible product picks', () => {
    expect(buildFilterHighlightTargets(['filter-price-max'], visibleProducts)).toEqual([
      'filter-price-max',
      'product-tent-green',
      'product-tent-shade',
    ]);
  });

  it('ranks highlighted products while ignoring non-product targets', () => {
    const highlights = ['filter-price-max', 'product-tent-green', 'product-tent-shade'];

    expect(getProductRecommendationRank('product-tent-green', highlights, visibleProducts)).toBe(1);
    expect(getProductRecommendationRank('product-tent-shade', highlights, visibleProducts)).toBe(2);
    expect(getProductRecommendationRank('product-tent-emergency', highlights, visibleProducts)).toBeNull();
  });
});
