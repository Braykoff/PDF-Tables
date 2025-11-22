import { TABLE_SCALE_FACTOR, ACTIVE_TABLE_COLOR, NORMAL_TABLE_COLOR } from "./constants.js";
import { clampedBy, isStringEmpty } from "./utils";

// MARK: Constants
/** Font size of index column label, px. */
const LABEL_FONT_SIZE = 10;

/** Padding above and below the index column label, px. */
const LABEL_VERTICAL_PADDING = 3;

/** Padding left and right the index column label, px. */
const LABEL_HORIZONTAL_PADDING = 4;

/** Ratio between a character's width and the font size for monospace Courier New font*/
const COURIER_NEW_SIZE_TO_WIDTH_RATIO = 0.6;

/** Ratio between a character's height and the font size for monospace Courier New font*/
const COURIER_NEW_SIZE_TO_HEIGHT_RATIO = 0.75;

/** Height of the index column label, px. */
const INDEX_LABEL_HEIGHT = fontSizeToHeight(LABEL_FONT_SIZE) + LABEL_VERTICAL_PADDING;

/**
 * Estimates the width of text with monospace Courier New font. If text is undefined, null, or 
 * otherwise empty, it will return 0.
 * @param {int} size The font size, px.
 * @param {string} text The text.
 * @returns The approximate width of the text, px.
 */
function fontSizeToWidth(size, text) {
  if (isStringEmpty(text)) { return 0; }

  return size * COURIER_NEW_SIZE_TO_WIDTH_RATIO * text.length;
}

/**
 * Estimates the height of text with monospace Courier New font.
 * @param {int} size The font size, px.
 * @returns The approximate height of the text, px.
 */
function fontSizeToHeight(size) {
  return COURIER_NEW_SIZE_TO_HEIGHT_RATIO * size;
}

/**
 * Handles rendering and dragging the index label on the table.
 */
export class IndexLabel {
  // MARK: Construction
  #page;
  #ctx;

  #dragging = false; // Whether this is actively being dragged
  #dragOffset = 0; // The distance the user has dragged the index column, px

  /**
   * Creates an object that handles the rendering and dragging of the index label on the table.
   * @param {Page} page The page that this index label is for.
   * @param {CanvasRenderingContext2D } ctx The context to draw onto.
   */
  constructor(page, ctx) {
    this.#page = page;
    this.#ctx = ctx;
  }

  // MARK: Dragging
  /**
   * Call this whenever the mouse moves while this is actively being dragged.
   * @param {float} deltaX The amount the mouse has moved in the x axis since the last call, px.
   */
  setDrag(deltaX) {
    // Update state
    this.#dragging = true;
    this.#dragOffset += deltaX;

    const halfOfIndexCol = this.#page.indexColWidth / 2;

    // Clamp index column dragging for first and last columns
    if (this.#page.indexCol === 0) {
      this.#dragOffset = Math.max(this.#dragOffset, -halfOfIndexCol);
    } else if (this.#page.indexCol === this.#page.colCount - 1) {
      this.#dragOffset = Math.min(this.#dragOffset, halfOfIndexCol);
    }

    // Check if our midpoint is now intercepting another column and reindex
    if (this.#dragOffset < -halfOfIndexCol) {
      // Index moves one to the left
      this.#page.setIndexColumn(this.#page.indexCol - 1);
      const newIdxColWidth = this.#page.indexColWidth;

      this.#dragOffset = newIdxColWidth / 2 + (this.#dragOffset + halfOfIndexCol);
    } else if (this.#dragOffset > halfOfIndexCol) {
      // Index moves one to the right
      this.#page.setIndexColumn(this.#page.indexCol + 1);
      const newIdxColWidth = this.#page.indexColWidth;

      this.#dragOffset = -newIdxColWidth / 2 + (this.#dragOffset - halfOfIndexCol);
    }
  }

  /**
   * Stops dragging. Call redraw() after this for changes to take effect.
   */
  stopDragging() {
    this.#dragOffset = 0;
    this.#dragging = false;
  }

  /**
   * Checks whether the given x, y, coordinate is within the table's index label.
   * @param {float} x The x coordinate relative to the top left of the page, px.
   * @param {float} y The y coordinate relative to the top left of the page, px.
   * @returns Whether this coordinate is within the index label.
   */
  isWithinLabel(x, y) {
    return (
      clampedBy(
        x,
        this.#page.tableX + this.#page.leftOfIndex,
        this.#page.tableX + this.#page.leftOfIndex + this.#page.indexColWidth,
      ) && clampedBy(
        y,
        this.#page.tableY - INDEX_LABEL_HEIGHT,
        this.#page.tableY,
      )
    );
  }

  // MARK: Redraw
  /**
   * Redraws this label on the table. Make sure the canvas context is cleared first.
   */
  redraw() {
    // Get label text
    let msg = null;

    for (const text of ["INDEX", "IDX", "I"]) {
      const textWidth = fontSizeToWidth(LABEL_FONT_SIZE, text);
      if (textWidth <= this.#page.indexColWidth - LABEL_HORIZONTAL_PADDING) {
        msg = text;
        break;
      }
    }

    // Draw index column label
    this.#ctx.fillStyle = NORMAL_TABLE_COLOR;
    this.#ctx.fillRect(
      (this.#page.tableX + this.#page.leftOfIndex + this.#dragOffset) * TABLE_SCALE_FACTOR,
      (this.#page.tableY - INDEX_LABEL_HEIGHT) * TABLE_SCALE_FACTOR,
      this.#page.indexColWidth * TABLE_SCALE_FACTOR,
      INDEX_LABEL_HEIGHT * TABLE_SCALE_FACTOR,
    );

    if (msg !== undefined) {
      this.#ctx.font = `bold ${LABEL_FONT_SIZE * TABLE_SCALE_FACTOR}px Courier New`;
      this.#ctx.fillStyle = "white";

      const textX =
        (this.#page.tableX +
          this.#page.leftOfIndex +
          this.#dragOffset +
          (this.#page.indexColWidth - fontSizeToWidth(LABEL_FONT_SIZE, msg)) / 2);

      this.#ctx.fillText(
        msg,
        textX * TABLE_SCALE_FACTOR,
        (this.#page.tableY - LABEL_VERTICAL_PADDING / 2) * TABLE_SCALE_FACTOR,
      );
    }

    // Shade in column if index column is being moved
    if (this.#dragging) {
      this.#ctx.fillStyle = ACTIVE_TABLE_COLOR;
      this.#ctx.globalAlpha = 0.2;
      this.#ctx.fillRect(
        (this.#page.tableX + this.#page.leftOfIndex) * TABLE_SCALE_FACTOR,
        this.#page.tableY * TABLE_SCALE_FACTOR,
        this.#page.indexColWidth * TABLE_SCALE_FACTOR,
        this.#page.tableHeight * TABLE_SCALE_FACTOR,
      );
      this.#ctx.globalAlpha = 1.0;
    }
  }
}
