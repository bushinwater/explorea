import type maplibregl from 'maplibre-gl';

const SRC_ID  = 'managed-region-source';
const FILL_ID = 'managed-region-fill';
const LINE_ID = 'managed-region-line';

const DEFAULT_COLOR = '#2DD4BF';

export interface RegionGeoItem {
  id: number;
  name: string;
  boundaryGeoJson: string;
}

const HANDLER_KEY = '__mr_handler';

/** Polls until the map style is ready, then runs the callback. */
function whenStyleReady(map: maplibregl.Map, cb: () => void): void {
  const tryRun = () => {
    let ok = false;
    try { ok = !!map.isStyleLoaded(); } catch { return; /* map was torn down */ }
    if (ok) cb();
    else setTimeout(tryRun, 50);
  };
  tryRun();
}

/**
 * Draws the user's managed region boundary on the given MapLibre map.
 * Idempotent — replaces any previous handler so calling repeatedly with
 * different boundaries doesn't stack listeners. Safe across theme changes
 * because the registered `style.load` handler re-draws the layers.
 */
export function drawManagedRegion(
  map: maplibregl.Map,
  boundaryGeoJson: string | object | null | undefined,
  color: string = DEFAULT_COLOR,
): void {
  if (!boundaryGeoJson) return;
  const geometry = typeof boundaryGeoJson === 'string' ? safeParse(boundaryGeoJson) : boundaryGeoJson;
  if (!geometry) return;

  const apply = (): void => {
    try {
      if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID);
      if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID);
      if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);
      map.addSource(SRC_ID, {
        type: 'geojson',
        data: { type: 'Feature', geometry, properties: {} } as any,
      });
      map.addLayer({
        id: FILL_ID,
        type: 'fill',
        source: SRC_ID,
        paint: { 'fill-color': color, 'fill-opacity': 0.12 },
      } as any);
      map.addLayer({
        id: LINE_ID,
        type: 'line',
        source: SRC_ID,
        paint: { 'line-color': color, 'line-width': 2, 'line-opacity': 0.9 },
      } as any);
    } catch { /* map may be torn down before listener fires */ }
  };

  // Replace any previous style.load handler (avoids stacking listeners when
  // drawManagedRegion is called multiple times on the same map).
  const prev = (map as any)[HANDLER_KEY] as (() => void) | undefined;
  if (prev) {
    try { map.off('style.load', prev); } catch { /* */ }
  }
  (map as any)[HANDLER_KEY] = apply;
  map.on('style.load', apply);

  // Poll until the style is ready, then apply. This is more reliable than
  // relying solely on `style.load` (which can race with the listener setup
  // when the boundary fetch resolves shortly after map creation).
  whenStyleReady(map, apply);
}

/** Removes the managed-region overlay layers/source if present. */
export function clearManagedRegion(map: maplibregl.Map): void {
  if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID);
  if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID);
  if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);
}

/**
 * Draws each region's boundary individually (used as a fallback for super_admin
 * when the country-wide outline can't be computed but regions are still returned).
 */
export function drawManagedRegions(
  map: maplibregl.Map,
  regions: RegionGeoItem[],
  color: string = DEFAULT_COLOR,
): void {
  if (!regions?.length) return;
  const features = regions
    .map(r => safeParse(r.boundaryGeoJson))
    .filter(g => g !== null)
    .map(g => ({ type: 'Feature', geometry: g, properties: {} }));
  if (!features.length) return;
  const fc = { type: 'FeatureCollection', features } as any;

  const apply = (): void => {
    try {
      if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID);
      if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID);
      if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);
      map.addSource(SRC_ID, { type: 'geojson', data: fc });
      map.addLayer({
        id: FILL_ID,
        type: 'fill',
        source: SRC_ID,
        paint: { 'fill-color': color, 'fill-opacity': 0.10 },
      } as any);
      map.addLayer({
        id: LINE_ID,
        type: 'line',
        source: SRC_ID,
        paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.85 },
      } as any);
    } catch { /* map may be torn down before listener fires */ }
  };

  const prev = (map as any)[HANDLER_KEY] as (() => void) | undefined;
  if (prev) {
    try { map.off('style.load', prev); } catch { /* */ }
  }
  (map as any)[HANDLER_KEY] = apply;
  map.on('style.load', apply);

  whenStyleReady(map, apply);
}

export interface RegionsGeoResponse {
  regions: RegionGeoItem[];
  serbiaOutline: string | null;
}

/**
 * High-level entry point: applies whichever overlay makes sense given the
 * server response and the user's locked region.
 * - SuperAdmin with country outline → single union polygon.
 * - SuperAdmin without outline but with regions → all regions drawn individually.
 * - TO with managed region → that single region.
 *
 * Returns the boundary used for point-in-polygon validation (or null).
 */
export function applyRegionScopeOverlay(
  map: maplibregl.Map | null | undefined,
  data: RegionsGeoResponse,
  lockedRegionId: number | null,
  options: { fit?: boolean } = {},
): { boundaryRaw: string | null; regions: RegionGeoItem[] | null } {
  const fit = options.fit !== false;
  if (data.serbiaOutline) {
    if (map) {
      drawManagedRegion(map, data.serbiaOutline);
      if (fit) fitMapToBoundary(map, data.serbiaOutline);
    }
    return { boundaryRaw: data.serbiaOutline, regions: null };
  }
  if (lockedRegionId !== null) {
    const region = data.regions.find(r => r.id === lockedRegionId);
    if (region?.boundaryGeoJson) {
      if (map) {
        drawManagedRegion(map, region.boundaryGeoJson);
        if (fit) fitMapToBoundary(map, region.boundaryGeoJson);
      }
      return { boundaryRaw: region.boundaryGeoJson, regions: null };
    }
  }
  if (data.regions.length > 0) {
    if (map) {
      drawManagedRegions(map, data.regions);
      if (fit) fitMapToRegions(map, data.regions);
    }
    return { boundaryRaw: null, regions: data.regions };
  }
  return { boundaryRaw: null, regions: null };
}

/** Fits the map viewport to the bounding box of all provided regions. */
export function fitMapToRegions(map: maplibregl.Map, regions: RegionGeoItem[]): void {
  if (!regions?.length) return;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const r of regions) {
    const geometry = safeParse(r.boundaryGeoJson);
    if (!geometry) continue;
    for (const c of extractCoords(geometry)) {
      if (c[0] < minLng) minLng = c[0];
      if (c[0] > maxLng) maxLng = c[0];
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
    }
  }
  if (!isFinite(minLng)) return;
  map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 30, duration: 600, maxZoom: 10 });
}

/** Fits the map viewport to the boundary's bounding box. */
export function fitMapToBoundary(map: maplibregl.Map, boundaryGeoJson: string | object): void {
  const geometry =
    typeof boundaryGeoJson === 'string' ? safeParse(boundaryGeoJson) : boundaryGeoJson;
  if (!geometry) return;
  const coords = extractCoords(geometry);
  if (!coords.length) return;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const c of coords) {
    if (c[0] < minLng) minLng = c[0];
    if (c[0] > maxLng) maxLng = c[0];
    if (c[1] < minLat) minLat = c[1];
    if (c[1] > maxLat) maxLat = c[1];
  }
  map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 30, duration: 600, maxZoom: 10 });
}

function safeParse(raw: string): any | null {
  try { return JSON.parse(raw); } catch { return null; }
}

function extractCoords(geom: any): number[][] {
  const out: number[][] = [];
  const walk = (val: any): void => {
    if (!val) return;
    if (Array.isArray(val) && typeof val[0] === 'number' && typeof val[1] === 'number') {
      out.push(val as number[]);
      return;
    }
    if (Array.isArray(val)) val.forEach(walk);
  };
  walk(geom.coordinates ?? geom);
  return out;
}
