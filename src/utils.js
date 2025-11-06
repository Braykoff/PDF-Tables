/**
 * Checks if a string is undefined, null, or only whitespace.
 * @param {str} string The string to check.
 * @returns True if the string is empty.
 */
function isStringEmpty(string) {
  return (string === undefined || string === null || string.trim().length === 0);
}

/**
 * Approximates the center of the affine transformation.
 * @param {Array} transform Affine transformation (a, b, c, d, e, f).
 * @param {float} width Width of the object
 * @returns The [x, y] center of the affine transformation.
 */
function getAffineTransformationCenter(transform, width) {
  const a = transform[0], b = transform[1],
    c = transform[2], d = transform[3],
    e = transform[4], f = transform[5];

  const h = Math.sqrt(c ** 2 + d ** 2);

  return [
    a * (width / 2) + c * (h / 2) + e,
    b * (width / 2) + d * (h / 2) + f
  ];
}
