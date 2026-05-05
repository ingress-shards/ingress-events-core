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
export interface NamedLocation extends Coordinates {
    /** Human-readable label for the location */
    label: string;
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
