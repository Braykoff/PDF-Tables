import { ACTIVE_TABLE_COLOR, NORMAL_TABLE_COLOR, PDF_SCALE_FACTOR } from "./constants.js";
import { Page } from "./page.js";
import { clampedBy, isStringEmpty } from "./utils.js";

// MARK: Constants
/** Font size of index column label, px. */
const LABEL_FONT_SIZE: number = 10 * PDF_SCALE_FACTOR; // eslint-disable-line no-magic-numbers

/** Padding above and below the index column label, px. */
const LABEL_VERTICAL_PADDING: number = 3 * PDF_SCALE_FACTOR; // eslint-disable-line no-magic-numbers

/** Padding left and right the index column label, px. */
// eslint-disable-next-line no-magic-numbers
const LABEL_HORIZONTAL_PADDING: number = 4 * PDF_SCALE_FACTOR;

/** Ratio between a character's width and the font size for monospace Courier New font*/
const COURIER_NEW_SIZE_TO_WIDTH_RATIO: number = 0.6;

/** Ratio between a character's height and the font size for monospace Courier New font*/
const COURIER_NEW_SIZE_TO_HEIGHT_RATIO: number = 0.75;

/** Height of the index column label, px. */
const INDEX_LABEL_HEIGHT: number = fontSizeToHeight(LABEL_FONT_SIZE) + LABEL_VERTICAL_PADDING;

/**
 * Estimates the width of text with monospace Courier New font. If text is undefined, null, or 
 * otherwise empty, it will return 0.
 * @param size The font size, px.
 * @param text The text.
 * @returns The approximate width of the text, px.
 */
function fontSizeToWidth(size: number, text: string): number {
  if (isStringEmpty(text)) { return 0; }

  return size * COURIER_NEW_SIZE_TO_WIDTH_RATIO * text.length;
}

/**
 * Estimates the height of text with monospace Courier New font.
 * @param size The font size, px.
 * @returns The approximate height of the text, px.
 */
function fontSizeToHeight(size: number): number {
  return COURIER_NEW_SIZE_TO_HEIGHT_RATIO * size;
}

/**
 * Handles rendering and dragging the index label on the table.
 */
export class IndexLabel {
  // MARK: Construction
  private _page: Page;
  private _ctx: CanvasRenderingContext2D;

  /** Whether this is actively being dragged. */
  private _dragging: boolean = false;
  /** The distance the user has dragged the index column, px. */
  private _dragOffset: number = 0;

  /**
   * Creates an object that handles the rendering and dragging of the index label on the table.
   * @param page The page that this index label is for.
   * @param ctx The context to draw onto.
   */
  constructor(page: Page, ctx: CanvasRenderingContext2D) {
    this._page = page;
    this._ctx = ctx;
  }

  // MARK: Dragging
  /**
   * Call this whenever the mouse moves while this is actively being dragged.
   * @param deltaX The amount the mouse has moved in the x axis since the last call, px.
   */
  setDrag(deltaX: number): void {
    // Update state
    this._dragging = true;
    this._dragOffset += deltaX;

    const halfOfIndexCol: number = this._page.indexColWidth / 2;

    // Clamp index column dragging for first and last columns
    if (this._page.indexCol === 0) {
      this._dragOffset = Math.max(this._dragOffset, -halfOfIndexCol);
    } else if (this._page.indexCol === this._page.colCount - 1) {
      this._dragOffset = Math.min(this._dragOffset, halfOfIndexCol);
    }

    // Check if our midpoint is now intercepting another column and reindex
    if (this._dragOffset < -halfOfIndexCol) {
      // Index moves one to the left
      this._page.setIndexColumn(this._page.indexCol - 1);
      const newIdxColWidth: number = this._page.indexColWidth;

      this._dragOffset = newIdxColWidth / 2 + (this._dragOffset + halfOfIndexCol);
    } else if (this._dragOffset > halfOfIndexCol) {
      // Index moves one to the right
      this._page.setIndexColumn(this._page.indexCol + 1);
      const newIdxColWidth: number = this._page.indexColWidth;

      this._dragOffset = -newIdxColWidth / 2 + (this._dragOffset - halfOfIndexCol);
    }
  }

  /**
   * Stops dragging. Call redraw() after this for changes to take effect.
   */
  stopDragging(): void {
    this._dragOffset = 0;
    this._dragging = false;
  }

  /**
   * Checks whether the given x, y, coordinate is within the table's index label.
   * @param x The x coordinate relative to the top left of the page, px.
   * @param y The y coordinate relative to the top left of the page, px.
   * @returns Whether this coordinate is within the index label.
   */
  isWithinLabel(x: number, y: number): boolean {
    return (
      clampedBy(
        x,
        this._page.tableX + this._page.leftOfIndex,
        this._page.tableX + this._page.leftOfIndex + this._page.indexColWidth,
      ) && clampedBy(
        y,
        this._page.tableY - INDEX_LABEL_HEIGHT,
        this._page.tableY,
      )
    );
  }

  // MARK: Redraw
  /**
   * Redraws this label on the table. Make sure the canvas context is cleared first.
   */
  redraw(): void {
    // Get label text
    let msg: string | null = null;

    for (const text of ["INDEX", "IDX", "I"]) {
      const textWidth: number = fontSizeToWidth(LABEL_FONT_SIZE, text);
      if (textWidth <= this._page.indexColWidth - LABEL_HORIZONTAL_PADDING) {
        msg = text;
        break;
      }
    }

    // Draw index column label
    this._ctx.fillStyle = NORMAL_TABLE_COLOR;
    this._ctx.fillRect(
      this._page.tableX + this._page.leftOfIndex + this._dragOffset,
      this._page.tableY - INDEX_LABEL_HEIGHT,
      this._page.indexColWidth,
      INDEX_LABEL_HEIGHT,
    );

    if (msg !== null) {
      this._ctx.font = `bold ${LABEL_FONT_SIZE}px Courier New`;
      this._ctx.fillStyle = "white";

      const textX: number =
        (this._page.tableX + this._page.leftOfIndex + this._dragOffset +
          (this._page.indexColWidth - fontSizeToWidth(LABEL_FONT_SIZE, msg)) / 2);

      this._ctx.fillText(msg, textX, this._page.tableY - LABEL_VERTICAL_PADDING / 2);
    }

    // Shade in column if index column is being moved
    if (this._dragging) {
      this._ctx.fillStyle = ACTIVE_TABLE_COLOR;
      this._ctx.globalAlpha = 0.2;
      this._ctx.fillRect(
        this._page.tableX + this._page.leftOfIndex,
        this._page.tableY,
        this._page.indexColWidth,
        this._page.tableHeight,
      );
      this._ctx.globalAlpha = 1.0;
    }
  }
}
