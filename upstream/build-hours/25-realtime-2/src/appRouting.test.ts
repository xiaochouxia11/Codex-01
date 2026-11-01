import { describe, expect, it } from 'vitest';
import { getDemoSurfaceForPath } from './appRouting';

describe('getDemoSurfaceForPath', () => {
  it('routes MetricLoop paths to the analytics product', () => {
    expect(getDemoSurfaceForPath('/metricloop')).toBe('analytics');
    expect(getDemoSurfaceForPath('/metricloop/')).toBe('analytics');
    expect(getDemoSurfaceForPath('/metricloop?variation=browser')).toBe('analytics');
  });

  it('keeps storefront paths in the ecommerce product', () => {
    expect(getDemoSurfaceForPath('/')).toBe('storefront');
    expect(getDemoSurfaceForPath('/products/tent-primary')).toBe('storefront');
    expect(getDemoSurfaceForPath('/?variation=browser#metricloop')).toBe('storefront');
  });
});
