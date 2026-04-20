/**
 * Rounds a number to a specified number of decimal places.
 * Includes safety guards for non-finite numbers.
 */
export const roundToDecimalPlaces = (num: number, decimals: number): number => {
    if (!Number.isFinite(num)) return num;
    if (decimals <= 0) return Math.round(num);
    const powerOfTen = 10 ** decimals;
    return Math.round(num * powerOfTen) / powerOfTen;
};

/**
 * Truncates a number to a specified number of decimal places.
 * Includes safety guards for non-finite numbers.
 */
export const truncateToDecimalPlaces = (num: number, decimals: number): number => {
    if (!Number.isFinite(num)) return num;
    if (decimals <= 0) return Math.trunc(num);
    const powerOfTen = 10 ** decimals;
    return Math.trunc(num * powerOfTen) / powerOfTen;
};
