/**
 * Checks if a string is undefined, null, or only whitespace.
 * @param {string} string The string to check.
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

/**
 * Converts a list of pages to a CSV file.
 * @param {BasePage} pages The list of Pages to use.
 * @returns The contents of the CSV file.
 */
export function writeCSV(pages) {
  if (pages.length === 0) return "";

  // Determine the max number of cols
  let maxCols = pages[0].colCount;

  for (let c = 1; c < pages.length; c++) {
    maxCols = Math.max(maxCols, pages[c].colCount);
  }

  if (maxCols === 0) return "";

  // Format header
  let out = "Column0";

  for (let c = 1; c < maxCols; c++) {
    out += `,Column${c}`;
  }

  // Append each page
  for (const p of pages) {
    out += "\n";
    out += p.getCSV(maxCols);
  }

  return out;
}

/**
 * Checks if a cell in a CSV table needs escaping, and escapes it if it does.
 * @param {string} cell The content of a single CSV cell to check.
 * @returns The escaped cell, in CSV format.
 */
export function escapeCSV(cell) {
  if (cell.indexOf(",") !== -1 || cell.indexOf("\n") !== -1 || cell.indexOf("\"") !== -1) {
    return `"${cell.replaceAll("\"", "\"\"")}"`;
  } else {
    return cell;
  }
}

/**
 * Downloads the specified content with the given name.
 * @param {string} name The name of the file when it downloads.
 * @param {string} content The content of the file.
 * @param {string} type The type of the file (Optional, default "text/csv").
 */
export function downloadFile(name, content, type = "text/csv") {
  // Create Blob for the file
  const blob = new Blob([content], { type: type });
  const url = URL.createObjectURL(blob);

  // Create temporary link, click
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();

  // Clean up Blob and link
  a.remove();
  URL.revokeObjectURL(url);
}
