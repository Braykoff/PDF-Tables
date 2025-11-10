import { DEFAULT_COL_SIZE, DEFAULT_ROW_SIZE, TEXT_BOX_COLOR, TEXT_BOX_RADIUS } from "./constants.js";
import { DraggableTable } from "./draggable-table.js";
import { getTextCenter, renderPDFOntoCanvas } from "./pdf-wrapper.js";
import { isStringEmpty } from "./utils.js";

/**
 * Represents a single PDF Page, with tables and text box annotations.
 */
export class Page {
  #idx;
  #width;
  #height;
  #words;
  #columnWidths;
  #tableWidth;
  #rowCount;
  #rowHeight;
  #tableCoords;
  #canvasContainer;
  #wordCanvas;
  #tableCanvas;
  #currentPageSupplier;

  /**
   * Creates a Page object. Use the async .create(...) method instead.
   * @param {*} pageContainer HTML DOM element containing every page.
   * @param {int} pageNum This page's index (starting at 1).
   * @param {function} currentPageSupplier A function returning the current page the user has scrolled to.
   * @param {Element} pdfCanvas The canvas with this page drawn on it.
   * @param {float} width The width of this page, px.
   * @param {float} height The height of this page, px.
   * @param {*} textContent A list of text boxes on this page (from page.getTextContent().items).
   * @param {int} colCount The number of columns on this page.
   * @param {int} rowCount The number of rows on this page.
   */
  constructor(pageContainer, pageNum, currentPageSupplier, pdfCanvas, width, height, textContent, colCount, rowCount) {
    // Init default values
    this.#idx = pageNum;
    this.#width = width;
    this.#height = height;

    this.#columnWidths = Array(colCount).fill(DEFAULT_COL_SIZE);
    this.#tableWidth = colCount * DEFAULT_COL_SIZE;
    this.#rowCount = rowCount;
    this.#rowHeight = DEFAULT_ROW_SIZE;
    this.#tableCoords = [5, 5];
    this.#currentPageSupplier = currentPageSupplier;

    // Create page container
    this.#canvasContainer = document.createElement("div");
    this.#canvasContainer.classList.add("page");
    pageContainer.appendChild(this.#canvasContainer);

    this.#canvasContainer.style.width = `${width}px`;
    this.#canvasContainer.style.height = `${height}px`;

    // Add PDF canvas
    this.#canvasContainer.appendChild(pdfCanvas);

    // Create word canvas
    this.#wordCanvas = document.createElement("canvas");
    this.#wordCanvas.width = width;
    this.#wordCanvas.height = height;

    this.#wordCanvas.classList.add("wordCanvas");
    this.#canvasContainer.appendChild(this.#wordCanvas);

    // Render words onto word canvas
    const wordCtx = this.#wordCanvas.getContext("2d");
    wordCtx.fillStyle = TEXT_BOX_COLOR;

    this.#words = [];

    for (const word of textContent) {
      if (!isStringEmpty(word.str)) {
        // Get pos relative to top left corner
        const pos = getTextCenter(word, height);

        this.#words.push({
          content: word.str,
          x: pos[0],
          y: pos[1]
        });

        // Render on canvas
        wordCtx.beginPath();
        wordCtx.arc(pos[0], pos[1], TEXT_BOX_RADIUS, 0, 2 * Math.PI);
        wordCtx.fill();
      }
    }

    // Create table canvas
    this.#tableCanvas = new DraggableTable(this);
  }

  /**
   * Create a new page.
   * @param {Element} pageContainer HTML DOM element containing every page. 
   * @param {PDFDocumentProxy} pdf PDF object returned by PDF.JS.
   * @param {function} currentPageSupplier A function returning the current page the user has scrolled to.
   * @param {int} pageNum Page number (starting at 1).
   * @param {int} colCount The number of columns on this page.
   * @param {int} rowCount The number of rows on this page.
   * @returns A Page object for this page.
   */
  static async create(pageContainer, pdf, currentPageSupplier, pageNum, rowCount, colCount) {
    // Await page, info
    const [canvas, page, width, height] = await renderPDFOntoCanvas(pdf, pageNum);

    // Await words
    const textContent = (await page.getTextContent()).items;

    // Pass off to constructor
    return new Page(pageContainer, pageNum, currentPageSupplier, canvas, width, height, textContent, colCount, rowCount);
  }

  /**
   * Sets whether the text boxes are shown or not.
   * @param {Boolean} shown Whether the text boxes are shown or not.
   */
  setTextboxesShown(shown) {
    this.#wordCanvas.style.visibility = shown ? "visible" : "hidden";
  }

  /**
   * Add a new canvas for this page.
   * @param {Element} canvas The canvas to add.
   */
  addCanvas(canvas) {
    this.#canvasContainer.appendChild(canvas);
  }

  /**
   * Sets the page to a specific cursor.
   * @param {string} cursor The CSS cursor to set to.
   */
  setCursor(cursor) {
    this.#canvasContainer.style.cursor = cursor;
  }

  /**
   * Detaches all event listeners, removes all elements.
   */
  destroy() {
    this.#tableCanvas.detach();
    this.#canvasContainer.remove();
  }

  /**
   * The width of this page, px.
   */
  get width() {
    return this.#width;
  }

  /**
   * The height of this page, px.
   */
  get height() {
    return this.#height;
  }

  /**
   * Gets the current page's bounding client rect (position relative to user's viewport).
   */
  get boundingClientRect() {
    return this.#canvasContainer.getBoundingClientRect();
  }

  /**
   * The distance between this page and the user's viewport center, px.
   */
  get distToCenter() {
    const rect = this.boundingClientRect;
    return Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2);
  }

  /**
   * The index of this page (starting at 1).
   */
  get index() {
    return this.#idx;
  }

  /**
   * The number of rows in this page's table.
   */
  get rowCount() {
    return this.#rowCount;
  }

  /**
   * The number of cols in this page's table.
   */
  get colCount() {
    return this.#columnWidths.length;
  }

  /**
   * Gets the x coordinate of the top-left corner of the table, relative to the page.
   */
  get tableX() {
    return this.#tableCoords[0];
  }

  /**
   * Gets the y coordinate of the top-left corner of the table, relative to the page.
   */
  get tableY() {
    return this.#tableCoords[1];
  }

  /**
   * Gets the total table width, px.
   */
  get tableWidth() {
    return this.#tableWidth;
  }

  /**
   * Gets the total table height, px.
   */
  get tableHeight() {
    return this.#rowHeight * this.#rowCount;
  }

  /**
   * Gets the width of a certain column
   * @param {int} col The index of the column.
   * @returns The width of the column, px.
   */
  getColWidth(col) {
    return this.#columnWidths[col];
  }

  /**
   * Gets the height of a row in the table, px.
   */
  get rowHeight() {
    return this.#rowHeight;
  }

  /**
   * Gets the number of pages between this page and the page at the center of the viewport.
   */
  get pagesFromViewport() {
    return Math.abs(this.#currentPageSupplier() - this.#idx);
  }
}