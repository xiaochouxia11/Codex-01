import type { Category, Product } from '../data';
import type {
  ProductReviewSummaryResponse,
  ReviewFocus,
} from '../reviewInsights';
import type { WeatherSearchResponse } from '../weatherSearch';

export type SupplyScreen = 'home' | 'results' | 'product' | 'cart';

export type SupplySort = 'most_relevant' | 'lowest_price' | 'best_rated';

export type SupplyConnectionStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export type SupplyRealtimePhase = 'commentary' | 'final_answer';

export interface SupplyCartItem {
  product: Product;
  quantity: number;
  size?: string;
}

export interface SupplyProductSummary {
  id: string;
  targetId: string;
  category: Category;
  title: string;
  seller: string;
  price: number;
  rating: number;
  reviews: number;
  shipping: string;
  full: boolean;
  sizes?: string[];
  isVisible: boolean;
}

export interface SupplySafeTarget {
  targetId: string;
  label: string;
  kind:
    | 'navigation'
    | 'search'
    | 'filter'
    | 'product'
    | 'product-option'
    | 'cart'
    | 'modal'
    | 'assistant';
  isVisible: boolean;
}

export interface SupplyScreenStateSnapshot {
  screen: SupplyScreen;
  activeCategory: Category;
  searchQuery: string;
  filters: {
    maxPrice: string;
    shoeSize: string;
    freeShippingOnly: boolean;
    fullOnly: boolean;
  };
  sort: SupplySort;
  selectedProduct: SupplyProductSummary | null;
  selectedShoeSize: string;
  quantity: number;
  cart: Array<{
    productId: string;
    title: string;
    quantity: number;
    size?: string;
    price: number;
  }>;
  visibleProducts: SupplyProductSummary[];
  highlightedTargets: string[];
  safeTargets: SupplySafeTarget[];
  sizeGuideOpen: boolean;
  capturedAtIso: string;
}

export interface SupplyActivityTrace {
  preambleText: string;
  toolActivities: SupplyToolActivity[];
  errorText: string | null;
}

export interface SupplyTranscriptMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  activityTrace?: SupplyActivityTrace;
}

export interface SupplyToolActivity {
  id: string;
  name: string;
  label: string;
  status: 'running' | 'done' | 'failed';
  details?: string[];
}

export interface SupplyActionResponse {
  status: 'done' | 'not-found' | 'not-visible' | 'blocked' | 'needs-selection';
  message?: string;
  targetId?: string;
  label?: string;
  product?: SupplyProductSummary;
  products?: SupplyProductSummary[];
  snapshot?: SupplyScreenStateSnapshot;
}

export interface SupplyHighlightResponse {
  applied: Array<{ targetId: string; label?: string; status: 'highlighted' }>;
  failed: Array<{ targetId: string; label?: string; status: 'not-found' | 'not-visible' }>;
  products: SupplyProductSummary[];
}

export interface GetScreenStateRequest {
  includeProducts?: boolean;
  includeTargets?: boolean;
}

export interface SearchProductsRequest {
  category: Category;
  query?: string;
}

export interface ApplyFiltersRequest {
  category?: Category;
  maxPrice?: number;
  shoeSize?: string;
  freeShippingOnly?: boolean;
  fullOnly?: boolean;
  sort?: SupplySort;
}

export interface HighlightProductsRequest {
  productIds?: string[];
  targetIds?: string[];
  category?: Category;
  count?: number;
  maxPrice?: number;
  shoeSize?: string;
}

export interface OpenProductRequest {
  productId?: string;
  targetId?: string;
  category?: Category;
  index?: number;
}

export interface SelectQuantityRequest {
  quantity: number;
}

export interface SelectShoeSizeRequest {
  size: string;
}

export interface AddToCartRequest {
  productId?: string;
  size?: string;
  quantity?: number;
}

export interface SummarizeProductReviewsRequest {
  productId?: string;
  targetId?: string;
  index?: number;
  focus?: ReviewFocus;
  maxReviews?: number;
}

export interface SearchWeatherWebRequest {
  location?: string;
  dateText?: string;
  concern?: string;
}

export interface HikingNeedsResponse {
  status: 'done';
  primaryItems: Array<{
    category: Category;
    label: string;
    reason: string;
  }>;
  optionalItems: Array<{
    label: string;
    reason: string;
  }>;
}

export interface SavedProfileResponse {
  status: 'done';
  profile: {
    name: string;
    preferredShoeSize: string;
    preferences: string[];
    recentPurchases: Array<{
      label: string;
      reason: string;
    }>;
  };
}

export interface SupplyAgentContextValue {
  snapshot: SupplyScreenStateSnapshot;
  getHikingNeeds: () => HikingNeedsResponse;
  getSavedProfile: () => SavedProfileResponse;
  getScreenState: (request?: GetScreenStateRequest) => SupplyScreenStateSnapshot;
  searchProducts: (request: SearchProductsRequest) => SupplyActionResponse;
  applyFilters: (request: ApplyFiltersRequest) => SupplyActionResponse;
  highlightProducts: (request: HighlightProductsRequest) => Promise<SupplyHighlightResponse>;
  openProduct: (request: OpenProductRequest) => Promise<SupplyActionResponse>;
  selectQuantity: (request: SelectQuantityRequest) => SupplyActionResponse;
  selectShoeSize: (request: SelectShoeSizeRequest) => SupplyActionResponse;
  openSizeGuide: () => SupplyActionResponse;
  closeSizeGuide: () => SupplyActionResponse;
  addToCart: (request?: AddToCartRequest) => SupplyActionResponse;
  summarizeProductReviews: (request: SummarizeProductReviewsRequest) => ProductReviewSummaryResponse;
  searchWeatherWeb: (request: SearchWeatherWebRequest) => Promise<WeatherSearchResponse>;
  goToCart: () => SupplyActionResponse;
  goHome: () => SupplyActionResponse;
  clearFilters: () => SupplyActionResponse;
}
