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

/**
 * Creates a HTML Canvas element.
 * @param {float} width The width of the canvas, px.
 * @param {float} height The height of the canvas, px.
 * @param {float} scale The amount to scale the internal dimensions (default 1.0)
 * @returns The canvas, and the canvas's 2d context.
 */
function createCanvas(width, height, scale=1.0) {
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  
  return [canvas, canvas.getContext("2d")];
}
