/**
 * Haversine formula — calculates distance between two GPS coordinates in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meters
}

/**
 * Returns a 0–1 score based on distance. Closer = higher score.
 * At 0m → 1.0, at radius → 0.0, beyond radius → negative (filtered out)
 */
export function distanceScore(distanceMeters: number, radiusMeters: number): number {
  return Math.max(0, 1 - distanceMeters / radiusMeters);
}
