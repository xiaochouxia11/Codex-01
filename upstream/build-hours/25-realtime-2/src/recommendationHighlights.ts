type ProductTarget = {
  target: string;
};

function uniqueTargets(targets: string[]) {
  return Array.from(new Set(targets.filter(Boolean)));
}

export function buildFilterHighlightTargets(
  changedControlTargets: string[],
  visibleProducts: ProductTarget[],
  maxTargets = 3,
) {
  const controls = uniqueTargets(changedControlTargets).slice(0, maxTargets);
  const productSlots = Math.max(0, maxTargets - controls.length);
  const productTargets = uniqueTargets(visibleProducts.map((product) => product.target)).slice(0, productSlots);

  return [...controls, ...productTargets].slice(0, maxTargets);
}

export function getRecommendedProductTargets(
  highlightTargets: string[],
  visibleProducts: ProductTarget[],
) {
  const visibleProductTargets = new Set(visibleProducts.map((product) => product.target));

  return uniqueTargets(highlightTargets).filter((target) => visibleProductTargets.has(target));
}

export function getProductRecommendationRank(
  productTarget: string,
  highlightTargets: string[],
  visibleProducts: ProductTarget[],
) {
  const index = getRecommendedProductTargets(highlightTargets, visibleProducts).indexOf(productTarget);

  return index === -1 ? null : index + 1;
}
