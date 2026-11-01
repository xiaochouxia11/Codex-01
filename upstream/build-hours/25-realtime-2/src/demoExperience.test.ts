import { describe, expect, it } from 'vitest';
import { products } from './data';
import { PRODUCT_PRICE_MULTIPLIER } from './data';
import {
  demoDelayPolicy,
  demoProfile,
  getCartCoverage,
  getProductMatchReasons,
  happyPathProductIds,
} from './demoExperience';

function productById(id: string) {
  const product = products.find((item) => item.id === id);
  if (!product) throw new Error(`Missing product: ${id}`);
  return product;
}

describe('voice shopping demo experience data', () => {
  it('uses a logged-in demo profile with US 10 as the saved shoe size', () => {
    expect(demoProfile.name).toBe('Demo Shopper');
    expect(demoProfile.preferredShoeSize).toBe('US 10');
    expect(demoProfile.preferences).toContain('waterproof gear');
    expect(demoProfile.recentPurchases.map((purchase) => purchase.label)).toEqual([
      '32L trail daypack',
      'merino trail socks',
      'insulated water bottle',
    ]);
  });

  it('keeps shoe product data gender-neutral and in standard US sizes', () => {
    const shoes = products.filter((product) => product.category === 'shoe');

    expect(shoes.length).toBeGreaterThan(0);
    expect(shoes.map((shoe) => shoe.title.toLowerCase()).join(' ')).not.toMatch(
      /\b(for men|for women|men's|women's|gender)\b/,
    );
    expect(shoes.flatMap((shoe) => shoe.sizes ?? [])).toEqual(
      expect.arrayContaining(['US 7', 'US 8', 'US 9', 'US 10', 'US 11']),
    );
    expect(shoes.every((shoe) => (shoe.sizes ?? []).every((size) => /^US \d+(\.5)?$/.test(size)))).toBe(true);
  });

  it('defines happy-path tent and shoe products that match the demo story', () => {
    const tent = productById(happyPathProductIds.tent);
    const shoe = productById(happyPathProductIds.shoe);

    expect(tent.category).toBe('tent');
    expect(tent.price).toBeLessThanOrEqual(450);
    expect(tent.attributes).toContainEqual(['Capacity', '3 to 4 people']);
    expect(getProductMatchReasons(tent)).toEqual(
      expect.arrayContaining(['Under $450', '3-4 people', 'Rain-ready tent']),
    );

    expect(shoe.category).toBe('shoe');
    expect(shoe.sizes).toContain(demoProfile.preferredShoeSize);
    expect(getProductMatchReasons(shoe)).toEqual(
      expect.arrayContaining(['US 10 available', 'Waterproof', 'Wet-trail grip']),
    );
  });

  it('scales product prices, old prices, and installment copy by 3x for the demo catalog', () => {
    const tent = productById(happyPathProductIds.tent);
    const shoe = productById(happyPathProductIds.shoe);

    expect(PRODUCT_PRICE_MULTIPLIER).toBe(3);
    expect(tent.price).toBe(419.85);
    expect(tent.oldPrice).toBe(599.85);
    expect(tent.installments).toBe('4 payments of $104.97');
    expect(shoe.price).toBe(387);
    expect(shoe.oldPrice).toBe(447);
    expect(shoe.installments).toBe('4 payments of $96.75');
  });

  it('separates cart coverage from suggested add-ons', () => {
    const coverage = getCartCoverage();

    expect(coverage.alreadyCovered.map((item) => item.label)).toEqual([
      '32L trail daypack',
      'merino trail socks',
      'insulated water bottle',
    ]);
    expect(coverage.stillUseful.map((item) => item.label)).toEqual([
      'Rain shell',
      'Headlamp',
      'Camp pillow',
      'Repair and stake kit',
    ]);
  });

  it('limits artificial delays to realistic assistant actions', () => {
    expect(demoDelayPolicy.planning.delayMs).toBe(0);
    expect(demoDelayPolicy.cartReview.delayMs).toBe(0);
    expect(demoDelayPolicy.search.preamble).toBe("I'll narrow those options.");
    expect(demoDelayPolicy.profileLookup.preamble).toBe("I'll check your saved preferences.");
    expect(demoDelayPolicy.cartUpdate.preamble).toBe("I'll add that to your cart.");
  });
});
