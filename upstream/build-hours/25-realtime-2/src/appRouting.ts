export type DemoSurface = 'storefront' | 'analytics';

export function getDemoSurfaceForPath(path: string): DemoSurface {
  const pathname = normalizePathname(path);

  return pathname === '/metricloop' || pathname.startsWith('/metricloop/')
    ? 'analytics'
    : 'storefront';
}

function normalizePathname(path: string) {
  try {
    return new URL(path, 'http://localhost').pathname;
  } catch {
    return path.split(/[?#]/)[0] || '/';
  }
}
