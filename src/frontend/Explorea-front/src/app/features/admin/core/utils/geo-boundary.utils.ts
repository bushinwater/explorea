function isPointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function isPointInGeoJsonGeometry(lat: number, lng: number, geom: any): boolean {
  if (geom.type === 'Polygon') {
    return isPointInRing(lat, lng, geom.coordinates[0]);
  }
  if (geom.type === 'MultiPolygon') {
    return (geom.coordinates as number[][][][]).some(poly => isPointInRing(lat, lng, poly[0]));
  }
  return true;
}

export function parseRegionBoundary(boundaryGeoJson: string): any | null {
  try {
    return JSON.parse(boundaryGeoJson);
  } catch {
    return null;
  }
}
