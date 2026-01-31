import type { Coordinates } from "../types/Geo.js";

export const haversineDistance = (coords1: Coordinates, coords2: Coordinates): number => {
    // Mean Earth Radius in meters
    const R = 6371000;
    const TO_RADIANS = Math.PI / 180;

    const lat1 = coords1.lat;
    const lon1 = coords1.lng;
    const lat2 = coords2.lat;
    const lon2 = coords2.lng;

    // Convert degrees to radians
    const dLat = (lat2 - lat1) * TO_RADIANS;
    const dLon = (lon2 - lon1) * TO_RADIANS;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * TO_RADIANS) * Math.cos(lat2 * TO_RADIANS) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;

    return roundToDecimalPlaces(distance, 2);
};

export const roundToDecimalPlaces = (num: number, decimals: number): number => {
    if (decimals <= 0) {
        return Math.round(num);
    }
    const powerOfTen = 10 ** decimals;
    return Math.round(num * powerOfTen) / powerOfTen;
};

export const truncateToDecimalPlaces = (num: number, decimals: number): number => {
    if (decimals <= 0) {
        return Math.trunc(num);
    }
    const powerOfTen = 10 ** decimals;
    return Math.trunc(num * powerOfTen) / powerOfTen;
};
