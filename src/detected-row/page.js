import { clamp } from "../shared/utils.js";
import { BasePage } from "../shared/base-page.js";
import { DEFAULT_TABLE_HEIGHT } from "./constants.js";
import { MIN_TABLE_HEIGHT } from "./constants.js";
import { DetectedRowInteractiveLayer } from "./interactive-layer.js";

/**
 * Represents a single PDF Page, with tables and text box annotations, in which the size of each row
 * is fixed.
 */
export class DetectedRowPage extends BasePage {
  #rowHeights;
  #tableHeight;

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
    super(pageContainer, pageNum, currentPageSupplier, pdfCanvas, width, height, textContent, DetectedRowInteractiveLayer);

    // Init table
    this.#rowHeights = [DEFAULT_TABLE_HEIGHT];
    this.#tableHeight = DEFAULT_TABLE_HEIGHT;

    // Initial draw
    this.forceRedraw();
  }

  setTableHeight(height) {
    height = clamp(height, MIN_TABLE_HEIGHT, this.height - this.tableY);

    this.#tableHeight = height;
    this.#rowHeights = [height];
  }

  /**
   * Auto detects rows in the table. This is done by looking at each of y positions of the text
   * boxes in the index (first) column.
   */
  detectRows() {
    let indexRowStop = this.tableX + this.getColWidth(0);
    let rowYPos = [];

    // Get the y position of each word in index row
    for (const word of this.words) {
      if (word.y >= this.tableY && word.y <= this.tableY + this.#tableHeight && word.x >= this.tableX && word.x <= indexRowStop) {
        rowYPos.push(word.y);
      }
    }

    if (rowYPos.length < 2) {
      // Only one row (or zero)
      console.log(`Tried to detect rows for page ${this.index}, but only ${rowYPos.length} rows found.`);
      this.#rowHeights = [this.#tableHeight];
      this.forceRedraw();
      return;
    }

    // Find minimum distance between two rows
    let minRowSize = rowYPos[1] - rowYPos[0];

    for (let r = 2; r < rowYPos.length; r++) {
      minRowSize = Math.min(minRowSize, rowYPos[r] - rowYPos[r - 1]);
    }

    // Each row ends at the previous text box y coord minus the default (minimum) row height / 2
    this.#rowHeights = [];
    let cumHeight = 0;

    for (let r = 1; r <= rowYPos.length; r++) {
      if (r === rowYPos.length) {
        // This is the last row, use bottom border
        this.#rowHeights.push(this.#tableHeight - cumHeight);
      } else {
        // This is not the last row, use next row
        let h = rowYPos[r] - this.tableY - cumHeight - (minRowSize / 2);
        cumHeight += h;
        this.#rowHeights.push(h);
      }
    }

    // Redraw
    this.forceRedraw();
  }

  copyFrom(template) {
    super.copyFrom(template);

    // Add height
    this.setTableHeight(template.tableHeight);

    // Redraw
    this.forceRedraw()
  }

  get rowCount() {
    return this.#rowHeights.length;
  }

  get tableHeight() {
    return this.#tableHeight;
  }

  getRowHeight(row) {
    return this.#rowHeights[row];
  }
}