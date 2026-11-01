import { PRODUCT_PRICE_MULTIPLIER, products, type Product } from './data';

export type ReviewFocus = 'critical' | 'positive' | 'all';

export type ReviewTheme = {
  label: string;
  detail: string;
  mentionShare: string;
};

export type RepresentativeReview = {
  id: string;
  rating: number;
  author: string;
  tripType: string;
  text: string;
};

export type ProductReviewInsights = {
  productId: string;
  averageRating: number;
  reviewCount: number;
  headline: string;
  positiveThemes: ReviewTheme[];
  criticalThemes: ReviewTheme[];
  representativeReviews: RepresentativeReview[];
};

export type ProductReviewSummaryResponse =
  | {
      status: 'done';
      product: {
        id: string;
        title: string;
        rating: number;
        reviews: number;
      };
      focus: ReviewFocus;
      headline: string;
      positiveThemes: ReviewTheme[];
      criticalThemes: ReviewTheme[];
      representativeReviews: RepresentativeReview[];
    }
  | {
      status: 'not-found';
      message: string;
    };

export type SummarizeProductReviewsRequest = {
  productId?: string;
  focus?: ReviewFocus;
  maxReviews?: number;
};

const primaryShoeInsights: ProductReviewInsights = {
  productId: 'shoe-primary',
  averageRating: 4.7,
  reviewCount: 391,
  headline: 'Reviews are mostly positive, with complaints concentrated around warmth and break-in.',
  positiveThemes: [
    {
      label: 'Keeps feet dry',
      detail: 'Most reviewers call out dry feet after mud, wet brush, and steady drizzle.',
      mentionShare: '46% of positive reviews',
    },
    {
      label: 'Confident wet-trail grip',
      detail: 'Hikers like the outsole on slick roots, gravel, and muddy switchbacks.',
      mentionShare: '38% of positive reviews',
    },
    {
      label: 'Works with thicker socks',
      detail: 'US 10 reviewers say the standard fit leaves room for merino trail socks.',
      mentionShare: '22% of positive reviews',
    },
  ],
  criticalThemes: [
    {
      label: 'Runs warm on long climbs',
      detail: 'Low-star reviews say the waterproof upper can feel hot during steep or humid hikes.',
      mentionShare: '31% of critical reviews',
    },
    {
      label: 'Break-in takes a few hikes',
      detail: 'Some reviewers mention ankle collar rubbing before the boot softens up.',
      mentionShare: '27% of critical reviews',
    },
    {
      label: 'Stiffer than casual trail shoes',
      detail: 'A few buyers expected a flexible day shoe and found the sole too structured.',
      mentionShare: '18% of critical reviews',
    },
  ],
  representativeReviews: [
    {
      id: 'shoe-primary-critical-1',
      rating: 1,
      author: 'M. Chen',
      tripType: 'Rainy forest day hike',
      text: 'The waterproofing worked, but my feet got hot fast and the ankle collar rubbed by mile three.',
    },
    {
      id: 'shoe-primary-critical-2',
      rating: 2,
      author: 'J. Rivera',
      tripType: 'Weekend backpacking trip',
      text: 'Good traction, but these needed more break-in than I expected before they felt comfortable.',
    },
    {
      id: 'shoe-primary-positive-1',
      rating: 5,
      author: 'A. Morgan',
      tripType: 'Wet coastal trail',
      text: 'Stayed dry through puddles and slick roots, and the grip was better than my old boots.',
    },
  ],
};

function productById(productId: string) {
  return products.find((product) => product.id === productId) ?? null;
}

function productRatingTone(product: Product) {
  if (product.rating >= 4.8) return 'excellent';
  if (product.rating >= 4.6) return 'strong';
  if (product.rating >= 4.4) return 'mixed-positive';
  return 'mixed';
}

function buildShoeInsights(product: Product): ProductReviewInsights {
  const tone = productRatingTone(product);
  const isBudget = product.price < 80 * PRODUCT_PRICE_MULTIPLIER;
  const isPremium = product.price > 150 * PRODUCT_PRICE_MULTIPLIER;
  const isLowerRated = product.rating < 4.5;

  const criticalThemes: ReviewTheme[] = isLowerRated
    ? [
        {
          label: 'Water resistance is mixed',
          detail: 'Lower-star reviews say the boot handles damp trails but can wet through in steady rain.',
          mentionShare: '34% of critical reviews',
        },
        {
          label: 'Support feels light',
          detail: 'Some hikers wanted more ankle structure on rocky or root-heavy trails.',
          mentionShare: '26% of critical reviews',
        },
        {
          label: 'Sizing runs narrow',
          detail: 'A few reviewers with thicker socks recommend trying a half size up.',
          mentionShare: '19% of critical reviews',
        },
      ]
    : [
        {
          label: isPremium ? 'Premium price scrutiny' : 'Break-in takes a few hikes',
          detail: isPremium
            ? 'Critical reviews mostly question whether the added mountain support is worth the price.'
            : 'Several low-star reviews mention collar stiffness during the first few wears.',
          mentionShare: isPremium ? '29% of critical reviews' : '28% of critical reviews',
        },
        {
          label: 'Can run warm',
          detail: 'The waterproof build gets warm for some hikers on dry climbs or summer trails.',
          mentionShare: '24% of critical reviews',
        },
        {
          label: isBudget ? 'Durability questions' : 'Structured sole feel',
          detail: isBudget
            ? 'Some buyers say the outsole shows wear sooner than expected after rough terrain.'
            : 'A few reviewers wanted a softer, more flexible stride for casual day walks.',
          mentionShare: isBudget ? '21% of critical reviews' : '17% of critical reviews',
        },
      ];

  return {
    productId: product.id,
    averageRating: product.rating,
    reviewCount: product.reviews,
    headline:
      tone === 'excellent'
        ? 'Reviews are excellent overall, with the few complaints focused on price and stiffness.'
        : tone === 'strong'
          ? 'Reviews are strong overall, with most low-star feedback about break-in and warmth.'
          : tone === 'mixed-positive'
            ? 'Reviews are positive but more mixed, especially around waterproofing and support.'
            : 'Reviews are mixed, with value praised but trail durability questioned.',
    positiveThemes: [
      {
        label: 'Good wet-trail grip',
        detail: 'Reviewers consistently like the traction on damp dirt, gravel, and roots.',
        mentionShare: '39% of positive reviews',
      },
      {
        label: isPremium ? 'Supportive mountain feel' : 'Comfortable for day hikes',
        detail: isPremium
          ? 'Higher-star reviews praise the secure mid-cut support on uneven trails.'
          : 'Most positive reviews say the boot feels comfortable for short weekend routes.',
        mentionShare: isPremium ? '33% of positive reviews' : '36% of positive reviews',
      },
      {
        label: 'Works in saved US 10',
        detail: 'US 10 reviewers generally say the fit is true with medium hiking socks.',
        mentionShare: '18% of positive reviews',
      },
    ],
    criticalThemes,
    representativeReviews: [
      {
        id: product.id + '-critical-1',
        rating: isLowerRated ? 1 : 2,
        author: 'K. Patel',
        tripType: 'Wet weekend hike',
        text: isLowerRated
          ? 'Fine on damp paths, but my socks were wet after a longer rainy section.'
          : 'The grip was solid, but the collar felt stiff until I had a couple hikes on them.',
      },
      {
        id: product.id + '-critical-2',
        rating: 2,
        author: 'S. Brooks',
        tripType: 'Forest trail loop',
        text: isPremium
          ? 'Very supportive, but for the price I expected them to feel more comfortable out of the box.'
          : 'They run warmer than I wanted once the climb gets steep.',
      },
      {
        id: product.id + '-positive-1',
        rating: 5,
        author: 'R. Lee',
        tripType: 'Misty morning trail',
        text: 'Good traction on wet roots and enough room for my hiking socks.',
      },
    ],
  };
}

function buildTentInsights(product: Product): ProductReviewInsights {
  return {
    productId: product.id,
    averageRating: product.rating,
    reviewCount: product.reviews,
    headline: 'Reviews are generally positive, with low-star feedback focused on setup details and wet-weather expectations.',
    positiveThemes: [
      {
        label: 'Good value for weekend trips',
        detail: 'Reviewers like the price-to-space balance for short camping trips.',
        mentionShare: '41% of positive reviews',
      },
      {
        label: 'Rain coverage is useful',
        detail: 'Positive reviews say the fly and floor handle light to moderate rain well.',
        mentionShare: '33% of positive reviews',
      },
      {
        label: 'Packs down cleanly',
        detail: 'Several reviewers mention easy storage after the trip.',
        mentionShare: '21% of positive reviews',
      },
    ],
    criticalThemes: [
      {
        label: 'Setup takes practice',
        detail: 'Low-star reviews say the first pitch is slower than advertised.',
        mentionShare: '30% of critical reviews',
      },
      {
        label: 'Not for heavy storms',
        detail: 'Some reviewers wanted stronger rain performance in sustained wind and downpour conditions.',
        mentionShare: '24% of critical reviews',
      },
      {
        label: 'Packed bag is tight',
        detail: 'A few buyers say repacking the tent into the included bag takes patience.',
        mentionShare: '18% of critical reviews',
      },
    ],
    representativeReviews: [
      {
        id: product.id + '-critical-1',
        rating: 2,
        author: 'T. Evans',
        tripType: 'Rainy campsite',
        text: 'Worked for light rain, but setup took longer than the listing made it sound.',
      },
      {
        id: product.id + '-critical-2',
        rating: 2,
        author: 'N. Ortiz',
        tripType: 'Windy overnight trip',
        text: 'Fine in calm weather, but I would not pick it for a heavy storm.',
      },
      {
        id: product.id + '-positive-1',
        rating: 5,
        author: 'L. Hart',
        tripType: 'Weekend lake camp',
        text: 'Plenty of room for the price and stayed dry through overnight drizzle.',
      },
    ],
  };
}

export function getProductReviewInsights(productId: string): ProductReviewInsights | null {
  if (productId === primaryShoeInsights.productId) return primaryShoeInsights;

  const product = productById(productId);
  if (!product) return null;

  return product.category === 'shoe' ? buildShoeInsights(product) : buildTentInsights(product);
}

export function summarizeProductReviews({
  productId,
  focus = 'critical',
  maxReviews = 2,
}: SummarizeProductReviewsRequest): ProductReviewSummaryResponse {
  if (!productId) {
    return {
      status: 'not-found',
      message: 'No product was selected for review analysis.',
    };
  }

  const product = productById(productId);
  const insights = getProductReviewInsights(productId);

  if (!product || !insights) {
    return {
      status: 'not-found',
      message: 'No synthetic review summary is available for that product.',
    };
  }

  const reviewsForFocus = insights.representativeReviews.filter((review) => {
    if (focus === 'positive') return review.rating >= 4;
    if (focus === 'critical') return review.rating <= 3;
    return true;
  });

  return {
    status: 'done',
    product: {
      id: product.id,
      title: product.title,
      rating: product.rating,
      reviews: product.reviews,
    },
    focus,
    headline: insights.headline,
    positiveThemes: insights.positiveThemes,
    criticalThemes: insights.criticalThemes,
    representativeReviews: reviewsForFocus.slice(0, Math.max(1, Math.min(maxReviews, 4))),
  };
}
