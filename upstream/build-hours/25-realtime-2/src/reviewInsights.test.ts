import { describe, expect, it } from 'vitest';
import { products } from './data';
import {
  getProductReviewInsights,
  summarizeProductReviews,
} from './reviewInsights';

describe('synthetic product review insights', () => {
  it('covers every hiking boot product with synthetic review themes', () => {
    const shoes = products.filter((product) => product.category === 'shoe');

    expect(shoes.length).toBeGreaterThan(0);
    expect(shoes.every((shoe) => getProductReviewInsights(shoe.id))).toBe(true);
  });

  it('summarizes critical reviews for the happy-path hiking boot', () => {
    const summary = summarizeProductReviews({ productId: 'shoe-primary', focus: 'critical' });

    expect(summary.status).toBe('done');
    if (summary.status !== 'done') throw new Error('Expected a review summary.');
    expect(summary.product?.id).toBe('shoe-primary');
    expect(summary.headline).toContain('mostly positive');
    expect(summary.criticalThemes.map((theme) => theme.label)).toEqual(
      expect.arrayContaining(['Runs warm on long climbs', 'Break-in takes a few hikes']),
    );
    expect(summary.representativeReviews.some((review) => review.rating <= 2)).toBe(true);
  });

  it('returns a not-found response for products without review fixtures', () => {
    const summary = summarizeProductReviews({ productId: 'missing-product', focus: 'critical' });

    expect(summary.status).toBe('not-found');
    if (summary.status !== 'not-found') throw new Error('Expected missing review summary.');
    expect(summary.message).toContain('No synthetic review summary');
  });
});
