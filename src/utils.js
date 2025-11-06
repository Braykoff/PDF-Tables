/**
 * Checks if a string is undefined, null, or only whitespace.
 * @param {str} string The string to check.
 * @returns True if the string is empty.
 */
function isStringEmpty(string) {
  return (string === undefined || string === null || string.trim().length === 0);
}

/**
 * Clamps a value between two others.
 * @param {*} val The value to clamp.
 * @param {*} min The minimum value.
 * @param {*} max The maximum value.
 * @returns The clamped value.
 */
function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
