import { PRODUCT_PRICE_MULTIPLIER, type Product } from './data';

export const happyPathProductIds = {
  tent: 'tent-primary',
  shoe: 'shoe-primary',
} as const;

export const demoProfile = {
  name: 'Demo Shopper',
  preferredShoeSize: 'US 10',
  preferences: ['waterproof gear', 'free shipping', 'weekend trips'],
  recentPurchases: [
    {
      label: '32L trail daypack',
      reason: 'Already covers day carry for layers, food, and small essentials.',
    },
    {
      label: 'merino trail socks',
      reason: 'Good pairing for the saved shoe size and wet trail conditions.',
    },
    {
      label: 'insulated water bottle',
      reason: 'Hydration is already handled for a short overnight route.',
    },
  ],
} as const;

export const demoDelayPolicy = {
  planning: { delayMs: 0, preamble: '' },
  search: { delayMs: 650, preamble: "I'll narrow those options." },
  profileLookup: { delayMs: 850, preamble: "I'll check your saved preferences." },
  cartUpdate: { delayMs: 450, preamble: "I'll add that to your cart." },
  reviewLookup: { delayMs: 700, preamble: "I'll scan the reviews." },
  weatherLookup: { delayMs: 900, preamble: "I'll check the forecast." },
  cartReview: { delayMs: 0, preamble: '' },
} as const;

export const demoTentMaxPrice = 150 * PRODUCT_PRICE_MULTIPLIER;

export const weekendKitTiles = [
  {
    label: 'Shelter',
    detail: '3-4 person tent with rain coverage',
    image: '/demo-assets/generated/tent-hero-web.png',
  },
  {
    label: 'Waterproof footwear',
    detail: 'US 10 trail shoes for wet terrain',
    image: '/demo-assets/generated/shoe-hero-web.png',
  },
  {
    label: 'Rain protection',
    detail: 'Shell layer for passing showers',
    image: '/demo-assets/generated/rain-shell-web.png',
  },
  {
    label: 'Camp comfort',
    detail: 'Small upgrades for the overnight kit',
    image: '/demo-assets/generated/camp-pillow-web.png',
  },
] as const;

export const stillUsefulItems = [
  {
    label: 'Rain shell',
    reason: 'Useful insurance for mist and passing showers.',
    image: '/demo-assets/generated/rain-shell-web.png',
  },
  {
    label: 'Headlamp',
    reason: 'Makes dusk setup and camp tasks easier.',
    image: '/demo-assets/generated/headlamp-web.png',
  },
  {
    label: 'Camp pillow',
    reason: 'Small comfort upgrade for the overnight stop.',
    image: '/demo-assets/generated/camp-pillow-web.png',
  },
  {
    label: 'Repair and stake kit',
    reason: 'Low-cost backup for wet ground and tent setup.',
    image: '/demo-assets/generated/repair-stake-kit-web.png',
  },
] as const;

export function getCartCoverage() {
  return {
    alreadyCovered: demoProfile.recentPurchases.map((purchase) => ({ ...purchase })),
    stillUseful: stillUsefulItems.map((item) => ({ ...item })),
  };
}

export function getProductMatchReasons(product: Product): string[] {
  const searchableText = [
    product.title,
    product.subtitle,
    product.details.join(' '),
    product.attributes.map(([label, value]) => `${label} ${value}`).join(' '),
  ].join(' ').toLowerCase();

  if (product.category === 'tent') {
    return [
      product.price <= demoTentMaxPrice ? 'Under $450' : null,
      /3\s*(to|-)?\s*4|3-4|3 to 4/.test(searchableText) ? '3-4 people' : null,
      /rain|waterproof|water-resistant|weather/.test(searchableText) ? 'Rain-ready tent' : null,
      /quick|fast|automatic|easy/.test(searchableText) ? 'Quick setup' : null,
      product.shipping.toLowerCase().includes('free') ? 'Free shipping' : null,
    ].filter((reason): reason is string => Boolean(reason)).slice(0, 4);
  }

  return [
    product.sizes?.includes(demoProfile.preferredShoeSize) ? 'US 10 available' : null,
    /waterproof|water-resistant|weather/.test(searchableText) ? 'Waterproof' : null,
    /grip|lugged|traction|outsole|terrain/.test(searchableText) ? 'Wet-trail grip' : null,
    product.shipping.toLowerCase().includes('free') ? 'Free shipping' : null,
  ].filter((reason): reason is string => Boolean(reason)).slice(0, 4);
}

export function getToolDelayMs(toolName: string): number {
  if (toolName === 'search_products' || toolName === 'apply_filters') return demoDelayPolicy.search.delayMs;
  if (toolName === 'get_saved_profile') return demoDelayPolicy.profileLookup.delayMs;
  if (toolName === 'add_to_cart') return demoDelayPolicy.cartUpdate.delayMs;
  if (toolName === 'summarize_product_reviews') return demoDelayPolicy.reviewLookup.delayMs;
  if (toolName === 'search_weather_web') return demoDelayPolicy.weatherLookup.delayMs;
  return 0;
}
