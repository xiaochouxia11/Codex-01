import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { brandAssets } from './assets';
import { categories, products, searchCopy, shoeSizes, type Category, type Product } from './data';
import {
  demoProfile,
  demoTentMaxPrice,
  getCartCoverage,
  getProductMatchReasons,
  weekendKitTiles,
} from './demoExperience';
import { SupplyAgentProvider } from './agent/SupplyAgentContext';
import { SupplyAssistant } from './agent/SupplyAssistant';
import { getDemoSurfaceForPath } from './appRouting';
import { MetricLoopDashboard } from './metricloop/MetricLoopDashboard';
import { buildFilterHighlightTargets, getProductRecommendationRank } from './recommendationHighlights';
import { getProductReviewInsights, summarizeProductReviews } from './reviewInsights';
import { searchWeatherWeb } from './weatherSearch';
import type {
  AddToCartRequest,
  ApplyFiltersRequest,
  GetScreenStateRequest,
  HighlightProductsRequest,
  HikingNeedsResponse,
  SavedProfileResponse,
  SupplyActionResponse,
  SupplyAgentContextValue,
  SupplyCartItem,
  SupplyHighlightResponse,
  SupplyProductSummary,
  SupplySafeTarget,
  SupplyScreen,
  SupplyScreenStateSnapshot,
  SupplySort,
  OpenProductRequest,
  SearchProductsRequest,
  SelectQuantityRequest,
  SelectShoeSizeRequest,
  SummarizeProductReviewsRequest,
  SearchWeatherWebRequest,
} from './agent/contracts';

type IconName =
  | 'cart'
  | 'chevron'
  | 'close'
  | 'heart'
  | 'location'
  | 'menu'
  | 'search'
  | 'shield'
  | 'truck';

const money = {
  format(value: number) {
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return `$${formatter.format(value)}`;
  },
};

const quantityOptions = [1, 2, 3, 4, 5, 6];

function shoeSizeTarget(prefix: 'filter-size' | 'shoe-size' | 'size-guide-select', size: string) {
  return prefix + '-' + size.toLowerCase().replace(/\s+/g, '-');
}

function inferCategory(query: string): Category {
  const normalized = query.toLowerCase();
  return normalized.includes('boot') || normalized.includes('shoe') ? 'shoe' : 'tent';
}

function productById(id: string) {
  return products.find((product) => product.id === id) ?? products[0];
}

function sortLabel(sort: SupplySort) {
  if (sort === 'lowest_price') return 'Lowest price';
  if (sort === 'best_rated') return 'Best rated';
  return 'Most relevant';
}

function productSummary(product: Product, isVisible = true): SupplyProductSummary {
  return {
    id: product.id,
    targetId: product.target,
    category: product.category,
    title: product.title,
    seller: product.seller,
    price: product.price,
    rating: product.rating,
    reviews: product.reviews,
    shipping: product.shipping,
    full: Boolean(product.full),
    sizes: product.sizes,
    isVisible,
  };
}

function filterProducts({
  category,
  freeShippingOnly,
  fullOnly,
  maxPrice,
  shoeSize,
  sort,
}: {
  category: Category;
  freeShippingOnly: boolean;
  fullOnly: boolean;
  maxPrice: string;
  shoeSize: string;
  sort: SupplySort;
}) {
  const filtered = products
    .filter((product) => product.category === category)
    .filter((product) => (maxPrice ? product.price <= Number(maxPrice) : true))
    .filter((product) => (category === 'shoe' && shoeSize ? product.sizes?.includes(shoeSize) : true))
    .filter((product) => (freeShippingOnly ? product.shipping.toLowerCase().includes('free') : true))
    .filter((product) => (fullOnly ? Boolean(product.full) : true));

  if (sort === 'lowest_price') {
    return [...filtered].sort((a, b) => a.price - b.price);
  }

  if (sort === 'best_rated') {
    return [...filtered].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  }

  return filtered;
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function findTargetElement(targetId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-agent-target="${CSS.escape(targetId)}"]`);
}

function isElementActuallyVisible(element: HTMLElement): boolean {
  const bounds = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);

  return (
    bounds.width > 0 &&
    bounds.height > 0 &&
    styles.display !== 'none' &&
    styles.visibility !== 'hidden' &&
    Number(styles.opacity) !== 0
  );
}

export function App() {
  if (getDemoSurfaceForPath(window.location.pathname) === 'analytics') {
    return <MetricLoopDashboard />;
  }

  return <StorefrontApp />;
}

function StorefrontApp() {
  const [screen, setScreen] = useState<SupplyScreen>('home');
  const [activeCategory, setActiveCategory] = useState<Category>('tent');
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('tent-primary');
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [shoeSizeFilter, setShoeSizeFilter] = useState('');
  const [freeShippingOnly, setFreeShippingOnly] = useState(false);
  const [fullOnly, setFullOnly] = useState(false);
  const [sortPreference, setSortPreference] = useState<SupplySort>('most_relevant');
  const [selectedShoeSize, setSelectedShoeSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [cart, setCart] = useState<SupplyCartItem[]>([]);
  const [lastAdded, setLastAdded] = useState<Product | null>(null);
  const [highlightTargets, setHighlightTargets] = useState<string[]>([]);

  const selectedProduct = productById(selectedProductId);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, selectedProductId, activeCategory]);

  const visibleProducts = useMemo(() => {
    return filterProducts({
      category: activeCategory,
      freeShippingOnly,
      fullOnly,
      maxPrice: priceMax,
      shoeSize: shoeSizeFilter,
      sort: sortPreference,
    });
  }, [activeCategory, freeShippingOnly, fullOnly, priceMax, shoeSizeFilter, sortPreference]);

  const runSearch = useCallback((category: Category, draft = searchCopy[category].query) => {
    setActiveCategory(category);
    setSearchDraft(draft);
    setScreen('results');
    setCategoryOpen(false);
    setSortOpen(false);
    setLastAdded(null);
    setHighlightTargets(category === 'tent' ? ['filter-price-max'] : [shoeSizeTarget('filter-size', demoProfile.preferredShoeSize)]);
  }, []);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const category = inferCategory(searchDraft || searchCopy.tent.query);
    runSearch(category, searchDraft || searchCopy[category].query);
  };

  const applyPriceFilter = useCallback(() => {
    const nextProducts = filterProducts({
      category: activeCategory,
      freeShippingOnly,
      fullOnly,
      maxPrice: priceDraft,
      shoeSize: shoeSizeFilter,
      sort: sortPreference,
    });

    setPriceMax(priceDraft);
    setHighlightTargets(buildFilterHighlightTargets(['filter-price-max'], nextProducts));
  }, [activeCategory, freeShippingOnly, fullOnly, priceDraft, shoeSizeFilter, sortPreference]);

  const openProduct = useCallback((product: Product) => {
    setSelectedProductId(product.id);
    setActiveCategory(product.category);
    setGalleryIndex(0);
    setQuantity(1);
    setScreen('product');
    setSortOpen(false);
    setLastAdded(null);
    if (product.category === 'shoe') {
      const nextShoeSize = shoeSizeFilter && product.sizes?.includes(shoeSizeFilter) ? shoeSizeFilter : '';
      setSelectedShoeSize(nextShoeSize);
      setHighlightTargets(nextShoeSize ? ['add-to-cart'] : [shoeSizeTarget('shoe-size', demoProfile.preferredShoeSize)]);
      return;
    }

    setHighlightTargets(['quantity-select']);
  }, [shoeSizeFilter]);

  const addSelectedProductToCart = useCallback((requested?: AddToCartRequest): SupplyActionResponse => {
    const requestedProduct = requested?.productId ? products.find((product) => product.id === requested.productId) : selectedProduct;
    if (!requestedProduct) {
      return { status: 'not-found', message: 'Product not found.' };
    }
    const product = requestedProduct;
    const nextQuantity = requested?.quantity ?? quantity;
    const nextSize = product.category === 'shoe' ? requested?.size ?? selectedShoeSize : undefined;

    if (product.category === 'shoe') {
      if (!nextSize) {
        setHighlightTargets([shoeSizeTarget('shoe-size', demoProfile.preferredShoeSize)]);
        return {
          status: 'needs-selection',
          message: 'Choose a shoe size first.',
          targetId: shoeSizeTarget('shoe-size', demoProfile.preferredShoeSize),
          product: productSummary(product),
        };
      }

      if (!product.sizes?.includes(nextSize)) {
        setHighlightTargets(['size-guide']);
        return {
          status: 'not-found',
          message: 'That size is not available for this product.',
          targetId: 'size-guide',
          product: productSummary(product),
        };
      }
    }

    if (requested?.quantity) {
      setQuantity(nextQuantity);
    }
    if (product.category === 'shoe' && nextSize) {
      setSelectedShoeSize(nextSize);
    }

    setCart((items) => {
      const existingIndex = items.findIndex(
        (item) => item.product.id === product.id && item.size === nextSize,
      );

      if (existingIndex === -1) {
        return [...items, { product, quantity: nextQuantity, size: nextSize }];
      }

      return items.map((item, index) =>
        index === existingIndex ? { ...item, quantity: item.quantity + nextQuantity } : item,
      );
    });
    setLastAdded(product);
    setHighlightTargets(['cart-review']);
    return {
      status: 'done',
      message: 'Added to cart.',
      targetId: 'cart-review',
      product: productSummary(product),
    };
  }, [quantity, selectedProduct, selectedShoeSize]);

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const buildSnapshot = useCallback(
    (request?: GetScreenStateRequest): SupplyScreenStateSnapshot => {
      const includeProducts = request?.includeProducts !== false;
      const includeTargets = request?.includeTargets !== false;
      const productTargets: SupplySafeTarget[] = visibleProducts.map((product) => ({
        targetId: product.target,
        label: product.title,
        kind: 'product',
        isVisible: Boolean(findTargetElement(product.target)),
      }));
      const baseTargets: SupplySafeTarget[] = [
        { targetId: 'assistant-launcher', label: 'Supply Co. Shopping Assistant', kind: 'assistant', isVisible: true },
        { targetId: 'search-input', label: 'Search field', kind: 'search', isVisible: Boolean(findTargetElement('search-input')) },
        { targetId: 'search-submit', label: 'Search button', kind: 'search', isVisible: Boolean(findTargetElement('search-submit')) },
        { targetId: 'filter-price-max', label: 'Maximum price', kind: 'filter', isVisible: Boolean(findTargetElement('filter-price-max')) },
        { targetId: 'filter-price-apply', label: 'Apply price', kind: 'filter', isVisible: Boolean(findTargetElement('filter-price-apply')) },
        { targetId: 'filter-free-shipping', label: 'Free shipping', kind: 'filter', isVisible: Boolean(findTargetElement('filter-free-shipping')) },
        { targetId: 'filter-full', label: 'Supply-ready items', kind: 'filter', isVisible: Boolean(findTargetElement('filter-full')) },
        {
          targetId: shoeSizeTarget('filter-size', demoProfile.preferredShoeSize),
          label: demoProfile.preferredShoeSize + ' filter',
          kind: 'filter',
          isVisible: Boolean(findTargetElement(shoeSizeTarget('filter-size', demoProfile.preferredShoeSize))),
        },
        { targetId: 'sort-menu', label: 'Sort menu', kind: 'filter', isVisible: Boolean(findTargetElement('sort-menu')) },
        { targetId: 'selected-product-title', label: 'Selected product title', kind: 'product', isVisible: Boolean(findTargetElement('selected-product-title')) },
        { targetId: 'product-gallery', label: 'Product gallery', kind: 'product', isVisible: Boolean(findTargetElement('product-gallery')) },
        { targetId: 'review-summary', label: 'Review summary', kind: 'product', isVisible: Boolean(findTargetElement('review-summary')) },
        { targetId: 'size-guide', label: 'Size guide', kind: 'product-option', isVisible: Boolean(findTargetElement('size-guide')) },
        {
          targetId: shoeSizeTarget('shoe-size', demoProfile.preferredShoeSize),
          label: 'Shoe size ' + demoProfile.preferredShoeSize,
          kind: 'product-option',
          isVisible: Boolean(findTargetElement(shoeSizeTarget('shoe-size', demoProfile.preferredShoeSize))),
        },
        { targetId: 'quantity-select', label: 'Quantity', kind: 'product-option', isVisible: Boolean(findTargetElement('quantity-select')) },
        { targetId: 'add-to-cart', label: 'Add to cart', kind: 'cart', isVisible: Boolean(findTargetElement('add-to-cart')) },
        { targetId: 'cart-review', label: 'Cart review', kind: 'cart', isVisible: Boolean(findTargetElement('cart-review')) },
        { targetId: 'cart-open', label: 'Cart', kind: 'navigation', isVisible: Boolean(findTargetElement('cart-open')) },
      ];

      return {
        screen,
        activeCategory,
        searchQuery: searchDraft || searchCopy[activeCategory].query,
        filters: {
          maxPrice: priceMax,
          shoeSize: shoeSizeFilter,
          freeShippingOnly,
          fullOnly,
        },
        sort: sortPreference,
        selectedProduct: screen === 'product' ? productSummary(selectedProduct) : null,
        selectedShoeSize,
        quantity,
        cart: cart.map((item) => ({
          productId: item.product.id,
          title: item.product.title,
          quantity: item.quantity,
          size: item.size,
          price: item.product.price,
        })),
        visibleProducts: includeProducts ? visibleProducts.map((product) => productSummary(product)) : [],
        highlightedTargets: highlightTargets,
        safeTargets: includeTargets ? [...baseTargets, ...productTargets] : [],
        sizeGuideOpen,
        capturedAtIso: new Date().toISOString(),
      };
    },
    [
      activeCategory,
      cart,
      freeShippingOnly,
      fullOnly,
      highlightTargets,
      priceMax,
      quantity,
      screen,
      searchDraft,
      selectedProduct,
      selectedShoeSize,
      shoeSizeFilter,
      sizeGuideOpen,
      sortPreference,
      visibleProducts,
    ],
  );

  const getHikingNeeds = useCallback((): HikingNeedsResponse => ({
    status: 'done',
    primaryItems: [
      {
        category: 'tent',
        label: 'Camping tent',
        reason: 'Shelter for sleeping and bad weather.',
      },
      {
        category: 'shoe',
        label: 'Hiking shoes',
        reason: 'Grip and support for uneven trails.',
      },
    ],
    optionalItems: [
      { label: 'Backpack', reason: 'Carry water, layers, and food.' },
      { label: 'Water bottle', reason: 'Stay hydrated on the trail.' },
      { label: 'Rain layer', reason: 'Useful if weather changes.' },
    ],
  }), []);

  const getSavedProfile = useCallback((): SavedProfileResponse => ({
    status: 'done',
    profile: {
      name: demoProfile.name,
      preferredShoeSize: demoProfile.preferredShoeSize,
      preferences: [...demoProfile.preferences],
      recentPurchases: demoProfile.recentPurchases.map((purchase) => ({ ...purchase })),
    },
  }), []);

  const searchProductsAgent = useCallback(
    (request: SearchProductsRequest): SupplyActionResponse => {
      const query = request.query || searchCopy[request.category].query;
      setPriceDraft('');
      setPriceMax('');
      setShoeSizeFilter('');
      setFreeShippingOnly(false);
      setFullOnly(false);
      setSortPreference('most_relevant');
      runSearch(request.category, query);

      const productsForCategory = filterProducts({
        category: request.category,
        freeShippingOnly: false,
        fullOnly: false,
        maxPrice: '',
        shoeSize: '',
        sort: 'most_relevant',
      }).slice(0, 3);

      return {
        status: 'done',
        message: `Showing ${query}.`,
        targetId: request.category === 'tent' ? 'filter-price-max' : shoeSizeTarget('filter-size', demoProfile.preferredShoeSize),
        products: productsForCategory.map((product) => productSummary(product)),
      };
    },
    [runSearch],
  );

  const applyFiltersAgent = useCallback(
    (request: ApplyFiltersRequest): SupplyActionResponse => {
      const nextCategory = request.category ?? (request.shoeSize ? 'shoe' : activeCategory);
      const nextMaxPrice = request.maxPrice === undefined ? priceMax : String(Math.round(request.maxPrice));
      const nextShoeSize = request.shoeSize === undefined ? shoeSizeFilter : request.shoeSize;
      const nextFreeShippingOnly = request.freeShippingOnly ?? freeShippingOnly;
      const nextFullOnly = request.fullOnly ?? fullOnly;
      const nextSort = request.sort ?? sortPreference;
      const nextProducts = filterProducts({
        category: nextCategory,
        freeShippingOnly: nextFreeShippingOnly,
        fullOnly: nextFullOnly,
        maxPrice: nextMaxPrice,
        shoeSize: nextShoeSize,
        sort: nextSort,
      });

      setActiveCategory(nextCategory);
      setSearchDraft(searchCopy[nextCategory].query);
      setScreen('results');
      setPriceDraft(nextMaxPrice);
      setPriceMax(nextMaxPrice);
      setShoeSizeFilter(nextCategory === 'shoe' ? nextShoeSize : '');
      setFreeShippingOnly(nextFreeShippingOnly);
      setFullOnly(nextFullOnly);
      setSortPreference(nextSort);
      setSortOpen(false);
      setLastAdded(null);

      const changedFilterTargets = [
        request.maxPrice !== undefined ? 'filter-price-max' : null,
        request.shoeSize ? shoeSizeTarget('filter-size', request.shoeSize) : null,
        request.freeShippingOnly !== undefined ? 'filter-free-shipping' : null,
        request.fullOnly !== undefined ? 'filter-full' : null,
      ].filter((target): target is string => Boolean(target));
      const nextHighlights = buildFilterHighlightTargets(changedFilterTargets, nextProducts);
      setHighlightTargets(nextHighlights);

      if (!nextProducts.length) {
        return {
          status: 'not-found',
          message: 'No matching products were found.',
          products: [],
        };
      }

      return {
        status: 'done',
        message: `${nextProducts.length} products match.`,
        products: nextProducts.slice(0, 3).map((product) => productSummary(product)),
      };
    },
    [activeCategory, freeShippingOnly, fullOnly, priceMax, shoeSizeFilter, sortPreference],
  );

  const highlightProductsAgent = useCallback(
    async (request: HighlightProductsRequest): Promise<SupplyHighlightResponse> => {
      const category = request.category ?? activeCategory;
      const count = request.count ?? 2;
      const candidates = filterProducts({
        category,
        freeShippingOnly,
        fullOnly,
        maxPrice: request.maxPrice === undefined ? priceMax : String(Math.round(request.maxPrice)),
        shoeSize: request.shoeSize ?? shoeSizeFilter,
        sort: sortPreference,
      });
      const productTargets = request.productIds
        ? request.productIds
            .map((id) => products.find((product) => product.id === id))
            .filter((product): product is Product => Boolean(product))
            .map((product) => product.target)
        : candidates.slice(0, count).map((product) => product.target);
      const requestedTargets = Array.from(new Set([...(request.targetIds ?? []), ...productTargets])).slice(0, 3);

      setHighlightTargets(requestedTargets);
      await waitForPaint();

      const applied: SupplyHighlightResponse['applied'] = [];
      const failed: SupplyHighlightResponse['failed'] = [];

      requestedTargets.forEach((targetId) => {
        const product = products.find((item) => item.target === targetId);
        const element = findTargetElement(targetId);

        if (!element) {
          failed.push({ targetId, label: product?.title, status: 'not-found' });
          return;
        }

        if (!isElementActuallyVisible(element)) {
          failed.push({ targetId, label: product?.title, status: 'not-visible' });
          return;
        }

        applied.push({ targetId, label: product?.title, status: 'highlighted' });
      });

      const firstVisible = requestedTargets
        .map((targetId) => findTargetElement(targetId))
        .find((element): element is HTMLElement => Boolean(element && isElementActuallyVisible(element)));
      firstVisible?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      await waitForPaint();

      const highlightedProducts = applied
        .map((result) => products.find((product) => product.target === result.targetId))
        .filter((product): product is Product => Boolean(product));

      return {
        applied,
        failed,
        products: highlightedProducts.map((product) => productSummary(product)),
      };
    },
    [activeCategory, freeShippingOnly, fullOnly, priceMax, shoeSizeFilter, sortPreference],
  );

  const openProductAgent = useCallback(
    async (request: OpenProductRequest): Promise<SupplyActionResponse> => {
      const category = request.category ?? activeCategory;
      const candidates = filterProducts({
        category,
        freeShippingOnly,
        fullOnly,
        maxPrice: priceMax,
        shoeSize: shoeSizeFilter,
        sort: sortPreference,
      });
      const product =
        (request.productId ? products.find((item) => item.id === request.productId) : null) ??
        (request.targetId ? products.find((item) => item.target === request.targetId) : null) ??
        (request.index ? candidates[request.index - 1] : null);

      if (!product) {
        return { status: 'not-found', message: 'Product not found.' };
      }

      openProduct(product);
      await waitForPaint();
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

      return {
        status: 'done',
        targetId: product.target,
        product: productSummary(product),
      };
    },
    [activeCategory, freeShippingOnly, fullOnly, openProduct, priceMax, shoeSizeFilter, sortPreference],
  );

  const selectQuantityAgent = useCallback((request: SelectQuantityRequest): SupplyActionResponse => {
    const nextQuantity = Math.min(Math.max(Math.round(request.quantity), 1), 6);
    setQuantity(nextQuantity);
    setHighlightTargets(['add-to-cart']);
    return { status: 'done', message: `Quantity set to ${nextQuantity}.`, targetId: 'quantity-select' };
  }, []);

  const selectShoeSizeAgent = useCallback(
    (request: SelectShoeSizeRequest): SupplyActionResponse => {
      if (selectedProduct.category !== 'shoe') {
        return { status: 'blocked', message: 'This product does not require shoe size.' };
      }

      if (!selectedProduct.sizes?.includes(request.size)) {
        setHighlightTargets(['size-guide']);
        return { status: 'not-found', message: 'That size is not visible for this product.', targetId: 'size-guide' };
      }

      setSelectedShoeSize(request.size);
      setHighlightTargets(['add-to-cart']);
      return { status: 'done', message: `Size ${request.size} selected.`, targetId: shoeSizeTarget('shoe-size', request.size) };
    },
    [selectedProduct],
  );

  const openSizeGuideAgent = useCallback((): SupplyActionResponse => {
    if (selectedProduct.category !== 'shoe') {
      return { status: 'blocked', message: 'Size guide is only available for shoes.' };
    }
    setSizeGuideOpen(true);
    setHighlightTargets(['size-guide-modal']);
    return { status: 'done', targetId: 'size-guide-modal' };
  }, [selectedProduct.category]);

  const closeSizeGuideAgent = useCallback((): SupplyActionResponse => {
    setSizeGuideOpen(false);
    setHighlightTargets(['add-to-cart']);
    return { status: 'done', targetId: 'add-to-cart' };
  }, []);

  const summarizeProductReviewsAgent = useCallback(
    (request: SummarizeProductReviewsRequest) => {
      const requestedProduct =
        (request.productId ? products.find((product) => product.id === request.productId) : null) ??
        (request.targetId ? products.find((product) => product.target === request.targetId) : null) ??
        (request.index ? visibleProducts[request.index - 1] : null) ??
        (screen === 'product' ? selectedProduct : visibleProducts[0]);

      if (!requestedProduct) {
        return summarizeProductReviews({
          productId: request.productId,
          focus: request.focus,
          maxReviews: request.maxReviews,
        });
      }

      setHighlightTargets(screen === 'product' && requestedProduct.id === selectedProduct.id
        ? ['review-summary']
        : [requestedProduct.target]);

      return summarizeProductReviews({
        productId: requestedProduct.id,
        focus: request.focus,
        maxReviews: request.maxReviews,
      });
    },
    [screen, selectedProduct, visibleProducts],
  );

  const searchWeatherWebAgent = useCallback((request: SearchWeatherWebRequest) => {
    return searchWeatherWeb(request);
  }, []);

  const goToCartAgent = useCallback((): SupplyActionResponse => {
    setScreen('cart');
    setLastAdded(null);
    setHighlightTargets(['cart-review']);
    return { status: 'done', targetId: 'cart-review', snapshot: buildSnapshot() };
  }, [buildSnapshot]);

  const goHomeAgent = useCallback((): SupplyActionResponse => {
    setScreen('home');
    setSearchDraft('');
    setLastAdded(null);
    setHighlightTargets([]);
    return { status: 'done', targetId: 'home-logo' };
  }, []);

  const clearFiltersAgent = useCallback((): SupplyActionResponse => {
    setPriceDraft('');
    setPriceMax('');
    setShoeSizeFilter('');
    setFreeShippingOnly(false);
    setFullOnly(false);
    setSortPreference('most_relevant');
    setHighlightTargets(['filter-price-max']);
    return { status: 'done', message: 'Filters cleared.' };
  }, []);

  const agentValue = useMemo<SupplyAgentContextValue>(
    () => ({
      snapshot: buildSnapshot(),
      getHikingNeeds,
      getSavedProfile,
      getScreenState: buildSnapshot,
      searchProducts: searchProductsAgent,
      applyFilters: applyFiltersAgent,
      highlightProducts: highlightProductsAgent,
      openProduct: openProductAgent,
      selectQuantity: selectQuantityAgent,
      selectShoeSize: selectShoeSizeAgent,
      openSizeGuide: openSizeGuideAgent,
      closeSizeGuide: closeSizeGuideAgent,
      addToCart: addSelectedProductToCart,
      summarizeProductReviews: summarizeProductReviewsAgent,
      searchWeatherWeb: searchWeatherWebAgent,
      goToCart: goToCartAgent,
      goHome: goHomeAgent,
      clearFilters: clearFiltersAgent,
    }),
    [
      addSelectedProductToCart,
      applyFiltersAgent,
      buildSnapshot,
      clearFiltersAgent,
      getSavedProfile,
      getHikingNeeds,
      goHomeAgent,
      goToCartAgent,
      highlightProductsAgent,
      openProductAgent,
      openSizeGuideAgent,
      searchProductsAgent,
      selectQuantityAgent,
      selectShoeSizeAgent,
      summarizeProductReviewsAgent,
      searchWeatherWebAgent,
      closeSizeGuideAgent,
    ],
  );

  return (
    <SupplyAgentProvider value={agentValue}>
      <div
        className="app"
        data-agent-screen={screen}
        data-agent-category={activeCategory}
        data-agent-highlight={highlightTargets.join(' ')}
      >
        <Header
          categoryOpen={categoryOpen}
          cartCount={cartCount}
          highlightTargets={highlightTargets}
          searchDraft={searchDraft}
          onCart={() => {
            setScreen('cart');
            setLastAdded(null);
            setHighlightTargets(['cart-review']);
          }}
          onCategoryToggle={() => setCategoryOpen((open) => !open)}
          onHome={goHomeAgent}
          onSearch={handleSearch}
          onSearchDraft={setSearchDraft}
        />

        <main>
          {screen === 'home' && <Home />}

          {screen === 'results' && (
            <ResultsPage
              activeCategory={activeCategory}
              freeShippingOnly={freeShippingOnly}
              fullOnly={fullOnly}
              highlightTargets={highlightTargets}
              priceDraft={priceDraft}
              priceMax={priceMax}
              products={visibleProducts}
              shoeSizeFilter={shoeSizeFilter}
              sortOpen={sortOpen}
              sortPreference={sortPreference}
              onApplyPrice={applyPriceFilter}
              onClearFilters={clearFiltersAgent}
              onOpenProduct={openProduct}
              onSetFreeShipping={setFreeShippingOnly}
              onSetFull={setFullOnly}
              onSetPriceDraft={setPriceDraft}
              onSetShoeSize={setShoeSizeFilter}
              onSetSortPreference={(sort) => {
                setSortPreference(sort);
                setSortOpen(false);
              }}
              onSortToggle={() => setSortOpen((open) => !open)}
            />
          )}

          {screen === 'product' && (
            <ProductPage
              galleryIndex={galleryIndex}
              highlightTargets={highlightTargets}
              product={selectedProduct}
              quantity={quantity}
              selectedShoeSize={selectedShoeSize}
              onAddToCart={() => addSelectedProductToCart()}
              onGalleryIndex={setGalleryIndex}
              onOpenSizeGuide={() => setSizeGuideOpen(true)}
              onQuantity={setQuantity}
              onSearchSuggestion={runSearch}
              onShoeSize={(size) => {
                setSelectedShoeSize(size);
                setHighlightTargets(['add-to-cart']);
              }}
            />
          )}

          {screen === 'cart' && (
            <CartPage
              cart={cart}
              subtotal={subtotal}
              onContinue={goHomeAgent}
              onRemove={(index) => setCart((items) => items.filter((_, itemIndex) => itemIndex !== index))}
            />
          )}
        </main>

        {lastAdded && (
          <AddedToast
            product={lastAdded}
            onClose={() => setLastAdded(null)}
            onViewCart={() => {
              setScreen('cart');
              setLastAdded(null);
              setHighlightTargets(['cart-review']);
            }}
          />
        )}

        {sizeGuideOpen && (
          <SizeGuideModal
            highlightTargets={highlightTargets}
            onClose={() => setSizeGuideOpen(false)}
            onSelect={(size) => {
              setSelectedShoeSize(size);
              setSizeGuideOpen(false);
              setHighlightTargets(['add-to-cart']);
            }}
          />
        )}

        <SupplyAssistant />
      </div>
    </SupplyAgentProvider>
  );
}

function Header({
  categoryOpen,
  cartCount,
  highlightTargets,
  searchDraft,
  onCart,
  onCategoryToggle,
  onHome,
  onSearch,
  onSearchDraft,
}: {
  categoryOpen: boolean;
  cartCount: number;
  highlightTargets: string[];
  searchDraft: string;
  onCart: () => void;
  onCategoryToggle: () => void;
  onHome: () => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onSearchDraft: (value: string) => void;
}) {
  return (
    <header className="site-header">
      <div className="header-top">
        <button
          className="logo-button"
          type="button"
          aria-label="Supply Co."
          onClick={onHome}
          data-agent-target="home-logo"
        >
          <img className="brand-logo" alt="" src={brandAssets.headerLogo} />
          <span className="sr-only">Supply Co.</span>
        </button>

        <form className="search-box" onSubmit={onSearch}>
          <input
            aria-label="Search products"
            data-agent-target="search-input"
            placeholder="Search for products"
            value={searchDraft}
            onChange={(event) => onSearchDraft(event.target.value)}
          />
          <button className="icon-button search-submit" type="submit" data-agent-target="search-submit">
            <Icon name="search" />
            <span className="sr-only">Search</span>
          </button>
        </form>

        <nav className="account-links" aria-label="Account navigation">
          <button type="button">Hi, {demoProfile.name}</button>
          <button className="create-account-button" type="button">
            Size Saved: {demoProfile.preferredShoeSize.replace(/^US\s+/, '')}
          </button>
          <button
            className={highlightTargets.includes('cart-review') ? 'cart-button agent-highlight' : 'cart-button'}
            type="button"
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
            data-agent-target="cart-open"
            onClick={onCart}
          >
            <Icon name="cart" />
            <strong>{cartCount}</strong>
          </button>
        </nav>
      </div>

      <div className="header-bottom">
        <nav className="nav-links" aria-label="Primary navigation">
          <button
            className={categoryOpen ? 'nav-button active' : 'nav-button'}
            type="button"
            data-agent-target="category-menu"
            onClick={onCategoryToggle}
          >
            <Icon name="menu" /> Categories
          </button>
          <button type="button">Archive</button>
          <button type="button">New</button>
          <button type="button">Outdoor</button>
          <button type="button">Apparel</button>
          <button className="supply-limited-link" type="button">
            Supply Limited
          </button>
          <button type="button">About</button>
          <button type="button">Help</button>
        </nav>
      </div>

      {categoryOpen && (
        <div className="category-flyout" data-agent-target="category-flyout">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

function Home() {
  return (
    <section className="home-shell">
      <div className="home-hero">
        <img
          className="hero-background"
          alt="Misty Pacific Northwest lakeside campsite with tent and evergreen forest"
          src="/demo-assets/generated/home-hero-web.png"
        />
        <div className="market-hero-copy">
          <span className="eyebrow">Pacific Northwest trail kit</span>
          <h1>Pack for a wet weekend out.</h1>
          <p>Shelter, waterproof footwear, and weather-ready essentials for overnight trails.</p>
          <button className="hero-cta" type="button">
            Build my kit <Icon name="chevron" />
          </button>
        </div>

        <div className="trail-kit-panel" aria-label="Weekend trail kit">
          <span>Weekend trail kit</span>
          <strong>Already covered</strong>
          <ul>
            {demoProfile.recentPurchases.map((purchase) => (
              <li key={purchase.label}>{purchase.label}</li>
            ))}
          </ul>
          <em>Next: tent and waterproof shoes</em>
        </div>
      </div>

      <section className="home-section kit-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Happy path</span>
            <h2>Weekend trail kit</h2>
          </div>
          <button type="button">View all</button>
        </div>
        <div className="home-action-row" aria-label="Weekend trail kit">
          {weekendKitTiles.map((item) => (
            <button className="home-action-card image-card" key={item.label} type="button">
              <img alt="" src={item.image} />
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
              <em>{item.label === 'Shelter' || item.label === 'Waterproof footwear' ? 'Shop next' : 'Suggested'}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="profile-strip" aria-label="Logged in shopper context">
        <div>
          <span>Signed in as {demoProfile.name}</span>
          <strong>Saved size {demoProfile.preferredShoeSize}</strong>
        </div>
        {demoProfile.preferences.map((preference) => (
          <b key={preference}>{preference}</b>
        ))}
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Outdoor edit</span>
            <h2>Suggested for the trip</h2>
          </div>
          <button type="button">Browse collection</button>
        </div>
        <div className="promo-row editorial-promo-row">
          {[
            ['Shelter under $150', '3-4 person tent with rain coverage', '/demo-assets/generated/tent-hero-web.png'],
            ['Waterproof footing', 'US 10 boots for wet forest trails', '/demo-assets/generated/shoe-hero-web.png'],
            ['Still useful', 'Rain shell, headlamp, and small camp comfort', '/demo-assets/generated/headlamp-web.png'],
          ].map(([title, detail, image]) => (
            <button className="editorial-promo" key={title} type="button">
              <img alt="" src={image} />
              <span>{title}</span>
              <strong>{detail}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="service-strip">
        <div>
          <Icon name="truck" />
          <span>Free shipping picks</span>
          <strong>Prioritized for the happy path</strong>
        </div>
        <div>
          <Icon name="shield" />
          <span>Weather ready</span>
          <strong>Waterproof and rain-aware matches</strong>
        </div>
        <div>
          <Icon name="cart" />
          <span>Stop at review</span>
          <strong>No checkout needed for the demo</strong>
        </div>
      </section>
    </section>
  );
}

function ResultsPage({
  activeCategory,
  freeShippingOnly,
  fullOnly,
  highlightTargets,
  priceDraft,
  priceMax,
  products: visibleProducts,
  shoeSizeFilter,
  sortOpen,
  sortPreference,
  onApplyPrice,
  onClearFilters,
  onOpenProduct,
  onSetFreeShipping,
  onSetFull,
  onSetPriceDraft,
  onSetShoeSize,
  onSetSortPreference,
  onSortToggle,
}: {
  activeCategory: Category;
  freeShippingOnly: boolean;
  fullOnly: boolean;
  highlightTargets: string[];
  priceDraft: string;
  priceMax: string;
  products: Product[];
  shoeSizeFilter: string;
  sortOpen: boolean;
  sortPreference: SupplySort;
  onApplyPrice: () => void;
  onClearFilters: () => void;
  onOpenProduct: (product: Product) => void;
  onSetFreeShipping: (enabled: boolean) => void;
  onSetFull: (enabled: boolean) => void;
  onSetPriceDraft: (value: string) => void;
  onSetShoeSize: (size: string) => void;
  onSetSortPreference: (sort: SupplySort) => void;
  onSortToggle: () => void;
}) {
  const copy = searchCopy[activeCategory];
  const appliedDemoChips = activeCategory === 'tent'
    ? ['3-4 person', `Under ${money.format(demoTentMaxPrice)}`, 'Rain-ready']
    : [demoProfile.preferredShoeSize, 'Waterproof', 'Saved preferences'];

  return (
    <section className="results-shell">
      <div className="related-strip" data-agent-target="related-searches">
        <strong>Related searches:</strong>
        {copy.related.map((item) => (
          <button key={item} type="button">
            {item}
          </button>
        ))}
      </div>

      <aside className="filter-panel">
        <p className="breadcrumb">{copy.breadcrumb}</p>
        <h2>{copy.heading}</h2>
        <span data-agent-target="results-count">{copy.count}</span>

        <div className="shipping-cards">
          <button type="button">
            <b>Ready</b>
            <span>Fast shipping on selected items</span>
          </button>
          <button type="button">
            <b>Partner</b>
            <span>Additional inventory sources</span>
          </button>
          <button type="button">
            <b>In stock</b>
            <span>Products ready for fulfillment</span>
          </button>
        </div>

        <div className="filter-block">
          <h3>Related searches</h3>
          {copy.related.map((item) => (
            <button key={item} type="button">
              {item}
            </button>
          ))}
        </div>

        <div className="filter-block">
          <h3>Shipping</h3>
          <label>
            <input
              checked={fullOnly}
              className={highlightTargets.includes('filter-full') ? 'agent-highlight' : ''}
              data-agent-target="filter-full"
              type="checkbox"
              onChange={(event) => onSetFull(event.target.checked)}
            /> Supply-ready
          </label>
          <label>
            <input
              checked={freeShippingOnly}
              className={highlightTargets.includes('filter-free-shipping') ? 'agent-highlight' : ''}
              data-agent-target="filter-free-shipping"
              type="checkbox"
              onChange={(event) => onSetFreeShipping(event.target.checked)}
            /> Free shipping
          </label>
          <label><input type="checkbox" /> In-stock items</label>
        </div>

        <div className="filter-block">
          <h3>Price</h3>
          <div className="price-filter">
            <input aria-label="Minimum price" placeholder="Min" />
            <input
              aria-label="Maximum price"
              className={highlightTargets.includes('filter-price-max') ? 'agent-highlight' : ''}
              data-agent-target="filter-price-max"
              inputMode="numeric"
              placeholder="Max"
              value={priceDraft}
              onChange={(event) => onSetPriceDraft(event.target.value.replace(/\D/g, ''))}
            />
            <button
              type="button"
              data-agent-target="filter-price-apply"
              disabled={!priceDraft}
              onClick={onApplyPrice}
            >
              Apply
            </button>
          </div>
        </div>

        {activeCategory === 'tent' ? (
          <>
            <div className="filter-block">
              <h3>Maximum capacity</h3>
              {['2 people or less', '3 people', '4 people', '5 people', '6 people or more'].map((item) => (
                <button key={item} type="button">{item}</button>
              ))}
            </div>
            <div className="filter-block">
              <h3>Type</h3>
              {['Automatic tents', 'Pop-up tents', 'Family tents', 'Rainfly tents'].map((item) => (
                <button key={item} type="button">{item}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="filter-block">
              <h3>Size</h3>
              <div className="size-grid">
                {shoeSizes.map((size) => (
                  <button
                    className={[
                      shoeSizeFilter === size ? 'selected' : '',
                      highlightTargets.includes(shoeSizeTarget('filter-size', size)) ? 'agent-highlight' : '',
                    ].join(' ')}
                    key={size}
                    type="button"
                    data-agent-target={shoeSizeTarget('filter-size', size)}
                    onClick={() => onSetShoeSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <button type="button">Show more</button>
            </div>
            <div className="filter-block">
              <h3>Terrain</h3>
              {['Wet trails', 'Mixed terrain', 'Day hikes'].map((item) => (
                <button key={item} type="button">{item}</button>
              ))}
            </div>
            <div className="filter-block">
              <h3>Color</h3>
              <div className="color-filter-row">
                {['black', 'brown', 'gray', 'green', 'beige'].map((color) => (
                  <button aria-label={color} className={`color-dot ${color}`} key={color} type="button" />
                ))}
              </div>
            </div>
          </>
        )}

        <div className="filter-block">
          <h3>Condition</h3>
          <label><input type="radio" name="condition" defaultChecked /> New</label>
          <label><input type="radio" name="condition" /> Used</label>
        </div>

        <div className="filter-block">
          <h3>Brand</h3>
          {(activeCategory === 'tent'
            ? ['Lawuto', 'Coleman', 'Naturehike', 'Camp Store']
            : ['Ridge & Rain', 'North Route', 'Mountain Pro', 'Cedar Ridge']
          ).map((item) => (
            <button key={item} type="button">{item}</button>
          ))}
        </div>
      </aside>

      <div className="results-main">
        <div className="results-topline">
          <div>
            <p>Search results for</p>
            <h1>{copy.query}</h1>
          </div>
          <div className="sort-control">
            <button type="button" data-agent-target="sort-menu" onClick={onSortToggle}>
              <span>Sort by</span> <strong>{sortLabel(sortPreference)}</strong> <Icon name="chevron" />
            </button>
            {sortOpen && (
              <div className="sort-menu">
                <button type="button" onClick={() => onSetSortPreference('most_relevant')}>Most relevant</button>
                <button type="button" onClick={() => onSetSortPreference('lowest_price')}>Lowest price</button>
                <button type="button" onClick={() => onSetSortPreference('best_rated')}>Best rated</button>
              </div>
            )}
          </div>
        </div>

        <div className="results-assurance" aria-label="Shopping benefits">
          <span><b>Trip</b> Pacific Northwest weekend</span>
          <span><b>Profile</b> {demoProfile.preferredShoeSize} saved size</span>
          <span><b>Focus</b> Tent and waterproof shoes</span>
        </div>

        <div className="chips demo-chips" aria-label="Assistant-applied context">
          {appliedDemoChips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>

        {(priceMax || shoeSizeFilter || freeShippingOnly || fullOnly) && (
          <div className="chips">
            {priceMax && <span data-agent-target="filter-chip-price">Up to {money.format(Number(priceMax))}</span>}
            {shoeSizeFilter && <span data-agent-target="filter-chip-size">Size {shoeSizeFilter}</span>}
            {freeShippingOnly && <span data-agent-target="filter-chip-free-shipping">Free shipping</span>}
            {fullOnly && <span data-agent-target="filter-chip-full">Supply-ready</span>}
            <button type="button" data-agent-target="clear-filters" onClick={onClearFilters}>Clear filters</button>
          </div>
        )}

        <div className="product-grid">
          {visibleProducts.map((product) => (
            <ProductCard
              highlightTargets={highlightTargets}
              key={product.id}
              product={product}
              recommendationRank={getProductRecommendationRank(product.target, highlightTargets, visibleProducts)}
              onOpen={() => onOpenProduct(product)}
            />
          ))}
        </div>

        <div className="results-footer">
          <span>Page 1 of 5</span>
          <strong>More results load as you browse</strong>
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  highlightTargets,
  product,
  recommendationRank,
  onOpen,
}: {
  highlightTargets: string[];
  product: Product;
  recommendationRank: number | null;
  onOpen: () => void;
}) {
  const discountAmount = Number(product.discount?.match(/\d+/)?.[0] ?? 0);
  const cardBadge = product.promoted ? 'FEATURED' : discountAmount >= 30 ? 'EDIT' : product.full ? 'READY' : 'NEW';
  const matchReasons = getProductMatchReasons(product);
  const colorDots = product.category === 'shoe'
    ? ['#111111', '#8a5b35', '#a5a9ad']
    : ['#2f6b4f', '#2c74a7', '#d9c19a'];

  const isRecommended = recommendationRank !== null;
  const cardClassName = [
    'product-card',
    highlightTargets.includes(product.target) ? 'agent-highlight' : '',
    isRecommended ? 'assistant-recommendation' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={cardClassName}
      type="button"
      data-agent-product-card={product.category}
      data-agent-target={product.target}
      onClick={onOpen}
    >
      <span className="favorite"><Icon name="heart" /></span>
      <span className="product-ribbon">{cardBadge}</span>
      {isRecommended && (
        <span className="assistant-pick-badge">Assistant pick {recommendationRank}</span>
      )}
      <span className="image-frame">
        <img alt={product.title} src={product.image} />
      </span>
      <span className="card-swatches" aria-hidden="true">
        {colorDots.map((color) => (
          <i key={color} style={{ background: color }} />
        ))}
      </span>
      <span className="match-badges">
        {matchReasons.slice(0, 3).map((reason) => (
          <b key={reason}>{reason}</b>
        ))}
      </span>
      <span className="product-title">{product.title}</span>
      <span className="seller-line">{product.seller}</span>
      <span className="price-row">
        {product.oldPrice && <small>{money.format(product.oldPrice)}</small>}
        <strong>{money.format(product.price)}</strong>
        {product.discount && <em>{product.discount}</em>}
      </span>
      <span className="installments">{product.installments}</span>
      <span className="shipping">{product.shipping}</span>
      <span className="card-meta">
        {product.full && <b>READY</b>}
        <span>{product.rating} ★</span>
        <span>{product.reviews} reviews</span>
        {product.promoted && <span>Featured</span>}
      </span>
    </button>
  );
}

function ProductPage({
  galleryIndex,
  highlightTargets,
  product,
  quantity,
  selectedShoeSize,
  onAddToCart,
  onGalleryIndex,
  onOpenSizeGuide,
  onQuantity,
  onSearchSuggestion,
  onShoeSize,
}: {
  galleryIndex: number;
  highlightTargets: string[];
  product: Product;
  quantity: number;
  selectedShoeSize: string;
  onAddToCart: () => void;
  onGalleryIndex: (index: number) => void;
  onOpenSizeGuide: () => void;
  onQuantity: (quantity: number) => void;
  onSearchSuggestion: (category: Category) => void;
  onShoeSize: (size: string) => void;
}) {
  const isShoe = product.category === 'shoe';
  const canAdd = !isShoe || Boolean(selectedShoeSize);
  const addCopy = canAdd ? 'Add to cart' : 'Choose size to continue';
  const matchReasons = getProductMatchReasons(product);
  const reviewInsights = getProductReviewInsights(product.id);

  return (
    <section className="pdp-shell">
      <button className="back-link" type="button" onClick={() => onSearchSuggestion(product.category)}>
        Back to results
      </button>

      <div className="pdp-layout">
        <div className="gallery" data-agent-target="product-gallery">
          <div className="thumbs">
            {product.gallery.map((image, index) => (
              <button
                className={galleryIndex === index ? 'selected' : ''}
                key={image + '-' + index}
                type="button"
                data-agent-target={`gallery-thumb-${index + 1}`}
                onClick={() => onGalleryIndex(index)}
              >
                <img alt={`${product.title} view ${index + 1}`} src={image} />
              </button>
            ))}
          </div>
          <div className="main-image">
            <img alt={product.title} src={product.gallery[galleryIndex]} />
          </div>
        </div>

        <article className="product-detail">
          <div className="pdp-meta-row">
            <span className="condition">New | {product.available} available</span>
            <span className="best-seller">Featured pick</span>
            <button type="button">Share</button>
          </div>
          <h1 data-agent-target="selected-product-title">{product.title}</h1>
          <div className="rating-line">
            <span>{product.rating}</span>
            <span>{'★'.repeat(Math.round(product.rating))}</span>
            <a>{product.reviews} reviews</a>
          </div>
          <button className="favorite-link" type="button" data-agent-target="favorite-product">
            <Icon name="heart" /> Save item
          </button>

          <div className="price-block">
            {product.oldPrice && <small>{money.format(product.oldPrice)}</small>}
            <strong>{money.format(product.price)}</strong>
            {product.discount && <em>{product.discount}</em>}
            <span>{product.installments}</span>
          </div>

          <div className="payment-note">
            <strong>Checkout options</strong>
            <span>Cards and installment options available.</span>
          </div>

          {product.color && (
            <div className="option-block">
              <h2>Color: {product.color}</h2>
              <span className="color-swatch" aria-label={product.color} />
            </div>
          )}

          {isShoe && (
            <div className="option-block">
              <div className="option-heading">
                <h2>Size: {selectedShoeSize || 'Choose a size'}</h2>
                <button type="button" data-agent-target="size-guide" onClick={onOpenSizeGuide}>
                  Size guide
                </button>
              </div>
              <div className="size-grid pdp-size-grid">
                {product.sizes?.map((size) => {
                  const targetId = shoeSizeTarget('shoe-size', size);
                  const isSelected = selectedShoeSize === size;
                  const isSavedSize = size === demoProfile.preferredShoeSize;
                  const isSavedRecommendation = isSavedSize && !selectedShoeSize;
                  const shouldPulse = highlightTargets.includes(targetId) && !isSavedRecommendation;

                  return (
                    <button
                      className={[
                        isSelected ? 'selected' : '',
                        isSavedRecommendation ? 'saved-size-recommendation' : '',
                        shouldPulse ? 'agent-highlight' : '',
                      ].join(' ')}
                      key={size}
                      type="button"
                      data-agent-target={targetId}
                      onClick={() => onShoeSize(size)}
                    >
                      {size}
                      <span>
                        {isSavedRecommendation
                          ? 'Recommended saved size'
                          : isSavedSize ? 'Saved size' : 'Available'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <section className="detail-section match-panel">
            <h2>Why this matches</h2>
            <div>
              {matchReasons.map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </div>
          </section>

          {reviewInsights && (
            <section
              className={highlightTargets.includes('review-summary') ? 'detail-section review-snapshot agent-highlight' : 'detail-section review-snapshot'}
              data-agent-target="review-summary"
            >
              <div className="review-snapshot-heading">
                <h2>Review snapshot</h2>
                <span>{reviewInsights.averageRating} ★ from {reviewInsights.reviewCount} reviews</span>
              </div>
              <p>{reviewInsights.headline}</p>
              <div className="review-theme-grid">
                <div>
                  <strong>Customers like</strong>
                  {reviewInsights.positiveThemes.slice(0, 2).map((theme) => (
                    <span key={theme.label}>{theme.label}</span>
                  ))}
                </div>
                <div>
                  <strong>Low-star themes</strong>
                  {reviewInsights.criticalThemes.slice(0, 2).map((theme) => (
                    <span key={theme.label}>{theme.label}</span>
                  ))}
                </div>
              </div>
              <blockquote>
                {reviewInsights.representativeReviews.find((review) => review.rating <= 2)?.text}
              </blockquote>
            </section>
          )}

          <section className="detail-section">
            <h2>What to know</h2>
            <ul>
              {product.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </section>

          <section className="detail-section specs">
            <h2>Characteristics</h2>
            <dl>
              {product.attributes.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </article>

        <aside className="purchase-panel">
          <div className="delivery-block">
            <Icon name="truck" />
            <div>
              <strong>{product.shipping}</strong>
              <span>Ships in 2 to 6 days depending on inventory.</span>
            </div>
          </div>
          <div className="delivery-block">
            <Icon name="shield" />
            <div>
              <strong>Protected purchase</strong>
              <span>Money back if the item is not what you expected.</span>
            </div>
          </div>

          <label className="quantity-row">
            Quantity
            <select
              className={highlightTargets.includes('quantity-select') ? 'agent-highlight' : ''}
              data-agent-target="quantity-select"
              value={quantity}
              onChange={(event) => onQuantity(Number(event.target.value))}
            >
              {quantityOptions.map((option) => (
                <option key={option} value={option}>
                  {option} unit{option > 1 ? 's' : ''}
                </option>
              ))}
            </select>
            <span>{product.available} available</span>
          </label>

          <button
            className="buy-now"
            type="button"
            data-agent-target="buy-now"
            disabled={!canAdd}
          >
            {canAdd ? 'Checkout now' : 'Choose size to continue'}
          </button>
          <button
            className={highlightTargets.includes('add-to-cart') ? 'add-cart agent-highlight' : 'add-cart'}
            type="button"
            data-agent-target="add-to-cart"
            disabled={!canAdd}
            onClick={onAddToCart}
          >
            {addCopy}
          </button>

          <div className="panel-payments">
            <strong>Checkout options</strong>
            <span>Pay with card or available installment options.</span>
            <button type="button">View options</button>
          </div>

          <div className="seller-box">
            <span>Supplied by</span>
            <strong>{product.seller}</strong>
            <p>Reliable fulfillment partner with fast dispatch and clear returns.</p>
            <div className="seller-meter" aria-label="Fulfillment quality">
              <i />
              <i />
              <i />
              <i />
              <i className="active" />
            </div>
            <div className="seller-stats">
              <span>Fast dispatch</span>
              <span>Good service</span>
              <span>On-time delivery</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function CartPage({
  cart,
  subtotal,
  onContinue,
  onRemove,
}: {
  cart: SupplyCartItem[];
  subtotal: number;
  onContinue: () => void;
  onRemove: (index: number) => void;
}) {
  const shipping = cart.length ? 0 : 0;
  const total = subtotal + shipping;
  const coverage = getCartCoverage();

  return (
    <section className="cart-shell" data-agent-target="cart-review">
      <div className="cart-main">
        <h1>Shopping cart</h1>
        {cart.length === 0 ? (
          <div className="empty-cart">
            <img alt="" src={brandAssets.globalLogo} />
            <h2>Your cart is empty</h2>
            <p>Add items to your cart and they will appear here.</p>
            <button type="button" onClick={onContinue}>Start shopping</button>
          </div>
        ) : (
          <>
            <div className="cart-delivery-banner">
              <Icon name="truck" />
              <div>
                <strong>Shipping group</strong>
                <span>Items are grouped where eligible.</span>
              </div>
            </div>
            <div className="cart-items">
              {cart.map((item, index) => (
                <div
                  className="cart-item"
                  data-agent-target={`cart-item-${item.product.id}`}
                  key={`${item.product.id}-${item.size ?? 'default'}-${index}`}
                >
                  <img alt={item.product.title} src={item.product.image} />
                  <div>
                    <h2>{item.product.title}</h2>
                    {item.size && <span>Size {item.size}</span>}
                    <small>{item.product.shipping}</small>
                    <button type="button" onClick={() => onRemove(index)}>Remove</button>
                  </div>
                  <strong>{item.quantity} x {money.format(item.product.price)}</strong>
                </div>
              ))}
            </div>

            <section className="cart-coverage">
              <div>
                <span className="section-kicker">Already covered</span>
                <h2>Past purchases for this trip</h2>
              </div>
              <div className="covered-grid">
                {coverage.alreadyCovered.map((item) => (
                  <article key={item.label}>
                    <strong>{item.label}</strong>
                    <p>{item.reason}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="cart-coverage">
              <div>
                <span className="section-kicker">Still useful</span>
                <h2>Optional add-ons</h2>
              </div>
              <div className="addon-grid">
                {coverage.stillUseful.map((item) => (
                  <article key={item.label}>
                    <img alt="" src={item.image} />
                    <strong>{item.label}</strong>
                    <p>{item.reason}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <aside className="cart-summary">
        <h2>Order summary</h2>
        <div>
          <span>Products</span>
          <strong>{money.format(subtotal)}</strong>
        </div>
        <div>
          <span>Shipping</span>
          <strong>Free</strong>
        </div>
        <div className="summary-total">
          <span>Total</span>
          <strong>{money.format(total)}</strong>
        </div>
        <button type="button" data-agent-target="checkout-continue" disabled={!cart.length}>
          Continue checkout
        </button>
        <div className="summary-benefits">
          <span>Protected purchase</span>
          <span>Free returns on eligible products</span>
        </div>
      </aside>
    </section>
  );
}

function AddedToast({
  product,
  onClose,
  onViewCart,
}: {
  product: Product;
  onClose: () => void;
  onViewCart: () => void;
}) {
  return (
    <div className="added-toast" role="status">
      <img alt={product.title} src={product.image} />
      <div>
        <strong>Added to cart</strong>
        <span>{product.title}</span>
      </div>
      <button type="button" onClick={onViewCart} data-agent-target="toast-view-cart">
        View cart
      </button>
      <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
        <Icon name="close" />
      </button>
    </div>
  );
}

function SizeGuideModal({
  highlightTargets,
  onClose,
  onSelect,
}: {
  highlightTargets: string[];
  onClose: () => void;
  onSelect: (size: string) => void;
}) {
  const rows = [
    ['US 7', '24.5 cm'],
    ['US 8', '25.4 cm'],
    ['US 9', '26.2 cm'],
    ['US 10', '27.1 cm'],
    ['US 11', '27.9 cm'],
    ['US 12', '28.8 cm'],
  ];

  return (
    <div
      className={highlightTargets.includes('size-guide-modal') ? 'modal-backdrop agent-highlight' : 'modal-backdrop'}
      data-agent-target="size-guide-modal"
    >
      <section className="size-modal" role="dialog" aria-modal="true" aria-labelledby="size-modal-title">
        <button className="modal-close" type="button" aria-label="Close size guide" onClick={onClose}>
          <Icon name="close" />
        </button>
        <h2 id="size-modal-title">Size guide</h2>
        <p>Compare brand size with foot length before adding hiking boots to the cart.</p>
        <table>
          <thead>
            <tr>
              <th>US size</th>
              <th>Foot length</th>
              <th>Profile</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(([us, length]) => (
              <tr key={us}>
                <td>{us}</td>
                <td>{length}</td>
                <td>{us === demoProfile.preferredShoeSize ? 'Saved size' : ''}</td>
                <td>
                  <button type="button" data-agent-target={shoeSizeTarget('size-guide-select', us)} onClick={() => onSelect(us)}>
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Icon({ name }: { name: IconName }) {
  const pathByName: Record<IconName, string> = {
    cart: 'M6 6h15l-1.5 8.5H8L6 3H3m6 16.5a1.5 1.5 0 1 0 0 .1m9-.1a1.5 1.5 0 1 0 0 .1',
    chevron: 'm6 9 6 6 6-6',
    close: 'M6 6l12 12M18 6 6 18',
    heart: 'M20.8 8.6c0 4.4-8.8 9.4-8.8 9.4S3.2 13 3.2 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8.8 2.6Z',
    location: 'M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    menu: 'M4 7h16M4 12h16M4 17h16',
    search: 'm21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z',
    shield: 'M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z',
    truck: 'M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a2 2 0 1 0 0 .1m10-.1a2 2 0 1 0 0 .1',
  };

  return (
    <svg aria-hidden="true" className="icon" fill="none" viewBox="0 0 24 24">
      <path d={pathByName[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
