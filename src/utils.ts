import { Page } from "./page";

/** A type representing a 2d pos. */
export interface Pos {
  x: number;
  y: number;
}

/** An empty 2d pos (NaN, NaN). */
export const EMPTY_POS: Pos = { x: NaN, y: NaN };


/**
 * Checks if a string is undefined, null, or only whitespace.
 * @param str The string to check.
 * @returns True if the string is empty.
 */
export function isStringEmpty(str: string | null | undefined): boolean {
  return (
    str === undefined ||
    str === null ||
    str.trim().length === 0
  );
}

/**
 * Clamps a value between two others.
 * @param val The value to clamp.
 * @param min The minimum value.
 * @param max The maximum value.
 * @returns The clamped value.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Checks if a value is within a certain distance (buffer) to another (target).
 * @param value The value to check.
 * @param target The target value.
 * @param buffer Maximum distance between value and target.
 * @returns If value if within buffer distance of target.
 */
export function isNear(value: number, target: number, buffer: number): boolean {
  return Math.abs(target - value) <= buffer;
}

/**
 * Checks if a value is between min and max. [min, max]
 * @param value The value to check.
 * @param min The min value.
 * @param max The max value.
 * @returns If the value is between min and max.
 */
export function clampedBy(value: number, min: number, max: number): boolean {
  return (value >= min && value <= max);
}

/**
 * Converts a list of pages to a CSV file.
 * @param pages The list of Pages to use.
 * @returns The contents of the CSV file.
 */
export function writeCSV(pages: Page[]): string {
  if (pages.length === 0) { return ""; }

  // Determine the max number of cols
  // Access of index 0 is safe because pages.length is not 0.
  let maxCols: number = pages[0]!.colCount;

  for (let c: number = 1; c < pages.length; c++) {
    // Access of index c is safe because of condition to for loop.
    maxCols = Math.max(maxCols, pages[c]!.colCount);
  }

  if (maxCols === 0) { return ""; }

  // Format header
  let out: string = "Column0";

  for (let c: number = 1; c < maxCols; c++) {
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
 * Downloads the specified content with the given name.
 * @param name The name of the file when it downloads.
 * @param content The content of the file.
 * @param type The type of the file (Optional, default "text/csv").
 */
export function downloadFile(name: string, content: string, type: string = "text/csv"): void {
  // Create Blob for the file
  const blob: Blob = new Blob([content], { type: type });
  const url: string = URL.createObjectURL(blob);

  // Create temporary link, click
  const a: HTMLAnchorElement = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();

  // Clean up Blob and link
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Gets the 2d context of a canvas safely, throwing if the browser does not support it.
 * @param canvas The canvas to get the context of.
 * @returns The canvas's 2d context.
 */
export function get2dCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx: CanvasRenderingContext2D | null = canvas.getContext("2d");

  if (ctx === null) {
    throw new Error("Browser does not support HTML Canvas 2d context!");
  }

  return ctx;
}
