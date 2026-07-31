/**
 * Earth's radius in meters.
 */
export const EARTH_RADIUS_METERS = 6371000;

/**
 * Distance in meters for aggregating portals into a site.
 */
const SITE_AGGREGATION_DISTANCE_METERS = 10000;

/**
 * Opaque type for coordinates multiplied by 1,000,000.
 * In JS, this is a number, but branding ensures it is treated as an E6 integer.
 */
export type E6Coord = number;

/**
 * Common geographic coordinate structure using E6 integers.
 */
export interface Coordinates {
    latE6: E6Coord;
    lngE6: E6Coord;
}

/**
 * Common structure for map-related coordinate data.
 */
export interface SiteLocation extends Coordinates {
    /** Human-readable name for the location */
    name: string;
}

/**
 * Calculates the great-circle distance between two points on a sphere using the haversine formula.
 * @returns {number} Distance in meters with raw precision.
 */
export const haversineDistance = (coords1: Coordinates, coords2: Coordinates): number => {
    const TO_RADIANS = Math.PI / 180;
    const E6 = 1000000;

    const lat1 = coords1.latE6 / E6;
    const lon1 = coords1.lngE6 / E6;
    const lat2 = coords2.latE6 / E6;
    const lon2 = coords2.lngE6 / E6;

    const dLat = (lat2 - lat1) * TO_RADIANS;
    const dLon = (lon2 - lon1) * TO_RADIANS;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * TO_RADIANS) * Math.cos(lat2 * TO_RADIANS) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_METERS * c;
};

/**
 * Checks if a target location is within the site aggregation distance from a site centroid.
 */
export const isWithinSiteRange = (siteCoords: Coordinates, targetCoords: Coordinates): boolean => {
    return haversineDistance(siteCoords, targetCoords) <= SITE_AGGREGATION_DISTANCE_METERS;
};

/**
 * Calculates the bounding box dimensions (width and height) for a set of coordinates.
 * @returns {Object} Width and height in meters.
 */
export const calculateBoundingBoxDimensions = (coords: Coordinates[]): { width: number; height: number } => {
    if (coords.length === 0) return { width: 0, height: 0 };

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const p of coords) {
        if (p.latE6 < minLat) minLat = p.latE6;
        if (p.latE6 > maxLat) maxLat = p.latE6;
        if (p.lngE6 < minLng) minLng = p.lngE6;
        if (p.lngE6 > maxLng) maxLng = p.lngE6;
    }

    const avgLat = (minLat + maxLat) / 2;
    const avgLng = (minLng + maxLng) / 2;

    const width = haversineDistance({ latE6: avgLat, lngE6: minLng }, { latE6: avgLat, lngE6: maxLng });
    const height = haversineDistance({ latE6: minLat, lngE6: avgLng }, { latE6: maxLat, lngE6: avgLng });

    return { width, height };
};

/**
 * Calculates the geographic centroid (average location) of a set of coordinates.
 * Returns undefined if the coordinates list is empty.
 */
export const calculateCentroid = (coords: Coordinates[]): Coordinates | undefined => {
    if (coords.length === 0) return undefined;
    let sumLat = 0;
    let sumLng = 0;
    for (const c of coords) {
        sumLat += c.latE6;
        sumLng += c.lngE6;
    }
    return {
        latE6: Math.round(sumLat / coords.length),
        lngE6: Math.round(sumLng / coords.length),
    };
};
