/**
 * Checks if a string is undefined, null, or only whitespace.
 * @param {str} string The string to check.
 * @returns True if the string is empty.
 */
export function isStringEmpty(string) {
  return (string === undefined || string === null || string.trim().length === 0);
}

/**
 * Clamps a value between two others.
 * @param {*} val The value to clamp.
 * @param {*} min The minimum value.
 * @param {*} max The maximum value.
 * @returns The clamped value.
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Checks if a value is within a certain distance (buffer) to another (target).
 * @param {float} value The value to check.
 * @param {float} target The target value.
 * @param {float} buffer Maximum distance between value and target.
 * @returns If value if within buffer distance of target.
 */
export function within(value, target, buffer) {
  return Math.abs(target - value) <= buffer;
}
