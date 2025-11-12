import { DEFAULT_COL_SIZE, DEFAULT_COLS, MAX_COLS, MIN_COL_SIZE, TEXT_BOX_COLOR, TEXT_BOX_RADIUS } from "./constants.js";
import { getTextCenter, renderPDFOntoCanvas } from "./pdf-wrapper.js";
import { clamp, escapeCSV, isStringEmpty } from "./utils.js";

/**
 * Base class to represents a single PDF Page, with tables and text box annotations.
 * Extended by FixedRowPage and DetectedRowPage classes.
 */
export class BasePage {
  #idx;
  #width;
  #height;
  #words;
  #canvasContainer;
  #wordCanvas;
  #currentPageSupplier;

  #columnWidths;
  #tableWidth;
  #tableCoords;
  #interactiveLayer

  /**
   * Creates a Page object. Use the async .create(...) method instead.
   * @param {*} pageContainer HTML DOM element containing every page.
   * @param {int} pageNum This page's index (starting at 1).
   * @param {function} currentPageSupplier A function returning the current page the user has scrolled to.
   * @param {Element} pdfCanvas The canvas with this page drawn on it.
   * @param {float} width The width of this page, px.
   * @param {float} height The height of this page, px.
   * @param {*} textContent A list of text boxes on this page (from page.getTextContent().items).
   * @param {extends InteractiveLayer} InteractiveLayerClass The class or subclass of InteractiveLayer
   * to use.
   */
  constructor(pageContainer, pageNum, currentPageSupplier, pdfCanvas, width, height, textContent, InteractiveLayerClass) {
    // Init default values
    this.#idx = pageNum;
    this.#width = width;
    this.#height = height;
    this.#currentPageSupplier = currentPageSupplier;

    // Init what is known about the table
    this.#columnWidths = Array(DEFAULT_COLS).fill(DEFAULT_COL_SIZE);
    this.#tableWidth = DEFAULT_COLS * DEFAULT_COL_SIZE;
    this.#tableCoords = [5, 5];

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

    // Sort word list left-to-right, top-to-bottom
    this.#words.sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    // Init interactive layer
    this.#interactiveLayer = new InteractiveLayerClass(this);
  }

  /**
   * Create a new page.
   * @param {Element} pageContainer HTML DOM element containing every page. 
   * @param {PDFDocumentProxy} pdf PDF object returned by PDF.JS.
   * @param {function} currentPageSupplier A function returning the current page the user has scrolled to.
   * @param {int} pageNum Page number (starting at 1).
   * @returns A Page object for this page.
   */
  static async create(pageContainer, pdf, currentPageSupplier, pageNum) {
    // Await page, info
    const [canvas, page, width, height] = await renderPDFOntoCanvas(pdf, pageNum);

    // Await words
    const textContent = (await page.getTextContent()).items;

    // Pass off to constructor
    return new this(pageContainer, pageNum, currentPageSupplier, canvas, width, height, textContent);
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
   * Clamps and sets the position of this table to a new position relative to the top left corner
   * of the page.
   * @param {float} x The x position of the table.
   * @param {float} y The y position of the table.
   */
  setPosition(x, y) {
    // Clamp to page edges
    this.#tableCoords[0] = clamp(x, 0, this.width - this.tableWidth);
    this.#tableCoords[1] = clamp(y, 0, this.height - this.tableHeight);
  }

  /**
   * Clamps and sets the width of a column of this table.
   * @param {int} col The index of the column to set.
   * @param {float} width The width of the column, px.
   * @return The clamped width, px.
   */
  setColumnWidth(col, width) {
    width = clamp(width, MIN_COL_SIZE, this.width - this.tableX - this.tableWidth + this.getColWidth(col));;
    let delta = width - this.#columnWidths[col];
    this.#tableWidth += delta;
    this.#columnWidths[col] = width;
  }

  /**
   * Clamps and sets the height of the table (and thus each row).
   * @param {float} height The height of the entire table.
   */
  setTableHeight(_height) {
    throw "This is a base class, override this function.";
  }

  /**
   * Clamps and sets a new number of columns for this page.
   * @param {int} newColCount The new number of columns.
   * @returns The clamped number of columns.
   */
  setColumnCount(newColCount) {
    newColCount = clamp(newColCount, 1, MAX_COLS);

    if (newColCount === this.colCount) {
      // No change in column count
      return newColCount;
    } else if (newColCount < this.colCount) {
      // Columns removed
      while (this.#columnWidths.length > newColCount) {
        this.#tableWidth -= this.#columnWidths.pop();
      }
    } else {
      // Columns added
      let colDelta = newColCount - this.colCount;
      let spaceOnLeft = this.width - this.tableX - this.#tableWidth;

      if (colDelta * DEFAULT_COL_SIZE <= spaceOnLeft) {
        // Fits perfectly
        this.#columnWidths.push(...Array(colDelta).fill(DEFAULT_COL_SIZE));
        this.#tableWidth += colDelta * DEFAULT_COL_SIZE;
      } else if (spaceOnLeft / colDelta >= MIN_COL_SIZE) {
        // Fits with resizing below default
        this.#columnWidths.push(...Array(colDelta).fill(spaceOnLeft / colDelta));
        this.#tableWidth += spaceOnLeft;
      } else if ((spaceOnLeft + this.tableX) / colDelta >= MIN_COL_SIZE) {
        // Fits with moving table to the left and below default
        this.setPosition(this.tableX - (colDelta - (spaceOnLeft / MIN_COL_SIZE)) * MIN_COL_SIZE, this.tableY);
        this.#columnWidths.push(...Array(colDelta).fill(MIN_COL_SIZE));
        this.#tableWidth += colDelta *= MIN_COL_SIZE;
      } else {
        // Doesn't even fit with moving the table, just cut columns
        return this.setColumnCount(this.colCount + Math.floor((spaceOnLeft + this.tableX) / MIN_COL_SIZE));
      }
    }

    // Redraw
    this.forceRedraw();
    return newColCount;
  }

  /**
   * Forces the interactive layer to stop dragging and redraw.
   */
  forceRedraw() {
    this.#interactiveLayer.stopDragging();
    this.#interactiveLayer.redraw();
  }

  /**
   * Attempts to copy the table layout of another page.
   * @param {BasePage} template The page to copy from. 
   */
  copyFrom(template) {
    this.setPosition(template.tableX, template.tableY);

    // Add columns
    this.#columnWidths = [];
    this.#tableWidth = 0;

    for (let c = 0; c < template.colCount; c++) {
      this.setColumnCount(c + 1);
      this.setColumnWidth(c, template.getColWidth(c));
    }
  }

  /**
   * Converts the words on this page into a csv file format with the specified number of columns.
   * @param {int} columns The number of columns in the full csv file.
   * @returns This table's CSV data.
   */
  getCSV(columns) {
    if (columns < this.colCount) {
      throw "Not enough columns!";
    }

    const table = Array.from(Array(this.rowCount), () => new Array(columns).fill(""));

    // Add each word
    for (const word of this.#words) {
      // Check not too far left/up
      if (word.x < this.tableX || word.y < this.tableY) continue;

      // Determine which column this word is in
      let colIdx = -1;
      let cumLength = 0;

      for (let c = 0; c < this.colCount; c++) {
        cumLength += this.getColWidth(c);

        if (word.x < this.tableX + cumLength) {
          colIdx = c;
          break;
        }
      }

      // Determine which row this word is in
      let rowIdx = -1;
      cumLength = 0;

      for (let r = 0; r < this.rowCount; r++) {
        cumLength += this.getRowHeight(r);

        if (word.y < this.tableY + cumLength) {
          rowIdx = r;
          break;
        }
      }

      // Check if inside table
      if (colIdx === -1 || rowIdx === -1) continue;

      // Add to table
      table[rowIdx][colIdx] += word.content;
    }

    // Format into csv format
    for (let r = 0; r < this.rowCount; r++) {
      // Escape each value in the row
      for (let c = 0; c < columns; c++) {
        table[r][c] = escapeCSV(table[r][c]);
      }

      table[r] = table[r].join(",");
    }

    return table.join("\n");
  }

  /**
   * Detaches all event listeners, removes all elements.
   */
  destroy() {
    this.#interactiveLayer.detach();
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
    throw "This is a base class, override this function.";
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
    throw "This is a base class, override this function.";
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
   * Gets the height of a certain row.
   * @param {int} row The index of the row.
   * @returns The height of the row, px.
   */
  getRowHeight(_row) {
    throw "This is a base class, override this function.";
  }

  /**
   * Gets the number of pages between this page and the page at the center of the viewport.
   */
  get pagesFromViewport() {
    return Math.abs(this.#currentPageSupplier() - this.#idx);
  }

  /**
   * Gets the words, x, y coordinates in top-bottom, left-right order.
   */
  get words() {
    return this.#words;
  }
}