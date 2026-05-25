export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export function patchStyleSources(style: any): any {
  if (typeof window === 'undefined' || window.location.hostname !== 'localhost') return style;
  const patched = JSON.parse(JSON.stringify(style)) as { sources?: Record<string, any> };
  for (const source of Object.values(patched.sources ?? {})) {
    const s = source as any;
    if (typeof s.url === 'string') {
      s.url = s.url.replace('https://tiles.openfreemap.org', '/tiles-proxy');
    }
    if (Array.isArray(s.tiles)) {
      s.tiles = (s.tiles as unknown[]).map(t =>
        typeof t === 'string' ? t.replace('https://tiles.openfreemap.org', '/tiles-proxy') : t,
      );
    }
  }
  return patched;
}
