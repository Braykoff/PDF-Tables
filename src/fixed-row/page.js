import { clamp } from "../shared/utils.js";
import { BasePage } from "../shared/base-page.js";
import { DEFAULT_ROW_SIZE, DEFAULT_ROWS, MAX_ROWS, MIN_ROW_SIZE } from "./constants.js";

/**
 * Represents a single PDF Page, with tables and text box annotations, in which the size of each row
 * is fixed.
 */
export class FixedRowPage extends BasePage {
  #rowCount;
  #rowHeight;

  /**
   * Creates a Page object. Use the async .create(...) method instead.
   * @param {*} pageContainer HTML DOM element containing every page.
   * @param {int} pageNum This page's index (starting at 1).
   * @param {function} currentPageSupplier A function returning the current page the user has scrolled to.
   * @param {Element} pdfCanvas The canvas with this page drawn on it.
   * @param {float} width The width of this page, px.
   * @param {float} height The height of this page, px.
   * @param {*} textContent A list of text boxes on this page (from page.getTextContent().items).
   */
  constructor(pageContainer, pageNum, currentPageSupplier, pdfCanvas, width, height, textContent) {
    super(pageContainer, pageNum, currentPageSupplier, pdfCanvas, width, height, textContent);

    // Init table
    this.#rowCount = DEFAULT_ROWS;
    this.#rowHeight = DEFAULT_ROW_SIZE;

    // Initial draw
    this.forceRedraw();
  }

  setTableHeight(height) {
    height = clamp(height, MIN_ROW_SIZE * this.#rowCount, this.height - this.tableY);
    this.#rowHeight = height / this.#rowCount;
  }

  /**
   * Clamps and sets a new number of rows for the page.
   * @param {*} newRowCount The new number of rows.
   * @returns The clamped number of rows
   */
  setRowCount(newRowCount) {
    newRowCount = clamp(newRowCount, 1, MAX_ROWS);

    if (newRowCount === this.rowCount) {
      // No change
      return newRowCount;
    } else if (newRowCount < this.rowCount) {
      // Rows removed
      this.#rowCount = newRowCount;
    } else {
      // Rows added
      let rowDelta = newRowCount - this.rowCount;
      let spaceBelow = this.height - this.tableY - this.tableHeight;

      if (this.#rowHeight * rowDelta <= spaceBelow) {
        // Fits perfectly
        this.#rowCount = newRowCount;
      } else if (this.#rowHeight * rowDelta <= spaceBelow + this.tableY) {
        // Fits with table moved up
        this.setPosition(this.tableX, this.tableY - (this.#rowHeight * rowDelta - spaceBelow));
        this.#rowCount = newRowCount;
      } else {
        // Will never fit, just cut rows
        return this.setRowCount(this.#rowCount + Math.floor((spaceBelow + this.tableY) / this.#rowHeight));
      }
    }

    this.forceRedraw();
    return newRowCount;
  }

  copyFrom(template) {
    super.copyFrom(template);

    // Add rows
    this.#rowHeight = template.getRowHeight(0);
    this.#rowCount = Math.min(template.rowCount, Math.floor((this.height - this.tableY) / this.#rowHeight));

    // Redraw
    this.forceRedraw();
  }

  get rowCount() {
    return this.#rowCount;
  }

  get tableHeight() {
    return this.#rowHeight * this.#rowCount;
  }

  getRowHeight(_row) {
    return this.#rowHeight;
  }
}