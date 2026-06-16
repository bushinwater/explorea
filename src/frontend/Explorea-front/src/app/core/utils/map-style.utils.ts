export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Cleans up the upstream OpenFreemap Liberty style for our use:
 *
 *   1. (Localhost only) rewrites tile URLs to go through the Angular dev
 *      proxy so the browser doesn't have to deal with CORS against
 *      tiles.openfreemap.org during development.
 *   2. (Always) makes the layer filters null-safe. Some vector tile
 *      features arrive with NULL for properties the upstream style's
 *      filters compare against (e.g. `intermittent`, `_symbol`, `rank`).
 *      MapLibre's tile parser then throws "Expected value to be of type
 *      number, but found null instead." into the worker console on every
 *      tile load — a non-fatal noise that drowns out real errors. Wrapping
 *      `["get", "foo"]` in `["coalesce", ["get", "foo"], 0]` turns a NULL
 *      into 0 before the comparison, which matches no string and compares
 *      false against any threshold, i.e. the feature is correctly hidden.
 */
export function patchStyleSources(style: any): any {
  const patched = JSON.parse(JSON.stringify(style)) as {
    sources?: Record<string, any>;
    layers?: any[];
  };

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    for (const source of Object.values(patched.sources ?? {})) {
      const s = source as any;
      if (typeof s.url === 'string') {
        s.url = s.url.replace('https://tiles.openfreemap.org', '/tiles-proxy');
      }
      if (Array.isArray(s.tiles)) {
        s.tiles = (s.tiles as unknown[]).map((t) =>
          typeof t === 'string' ? t.replace('https://tiles.openfreemap.org', '/tiles-proxy') : t,
        );
      }
    }
  }

  for (const layer of patched.layers ?? []) {
    if (layer && layer.filter !== undefined) {
      layer.filter = sanitizeFilterExpression(layer.filter, null);
    }
  }

  return patched;
}

/**
 * Recursively rewrites `["get", "prop"]` to `["coalesce", ["get", "prop"], 0]`
 * so MapLibre's evaluator doesn't throw when the feature property is NULL.
 * Skips rewriting inside `coalesce` (already safe) and `has` (asks about
 * existence, not value).
 */
function sanitizeFilterExpression(node: any, parentOp: string | null): any {
  if (!Array.isArray(node)) return node;

  const [op, ...args] = node;

  if (op === 'get' && args.length === 1 && parentOp !== 'coalesce' && parentOp !== 'has') {
    return ['coalesce', node, 0];
  }

  return [op, ...args.map((arg: any) => sanitizeFilterExpression(arg, typeof op === 'string' ? op : null))];
}
