import { DEFAULT_COL_SIZE, DEFAULT_COLS, DEFAULT_TABLE_HEIGHT, MAX_COLS, MIN_COL_SIZE, MIN_TABLE_HEIGHT, TEXT_BOX_COLOR, TEXT_BOX_RADIUS } from "./constants.js";
import { InteractiveLayer } from "./interactive-layer.js";
import { getTextCenter, renderPDFOntoCanvas } from "./pdf-wrapper.js";
import { clamp, isStringEmpty } from "./utils.js";

/**
 * Checks if a cell in a CSV table needs escaping, and escapes it if it does.
 * @param {string} cell The content of a single CSV cell to check.
 * @returns The escaped cell, in CSV format.
 */
function escapeCSV(cell) {
  if (cell.indexOf(",") !== -1 || cell.indexOf("\n") !== -1 || cell.indexOf("\"") !== -1) {
    return `"${cell.replaceAll("\"", "\"\"")}"`;
  } else {
    return cell;
  }
}

/**
 * Represents a single PDF page, with tables and text box annotations.
 */
export class Page {
  // MARK: Properties
  // Page properties
  #idx;
  #width;
  #height;
  #words;

  // Page elements
  #canvasContainer;
  #wordCanvas;
  #interactiveLayer
  #currentPageSupplier;

  // Table properties
  #columnWidths;
  #tableWidth;
  #rowHeights;
  #tableHeight;
  #tableCoords;

  // MARK: Construction
  /**
   * Creates a Page object. Use the async .create(...) method instead.
   * @param {*} pageContainer HTML DOM element containing every page.
   * @param {int} pageNum This page's index (starting at 1).
   * @param {function} currentPageSupplier A function returning the current page the user has scrolled to.
   * @param {Element} pdfCanvas The canvas with this page drawn on it.
   * @param {float} width The width of this page, px.
   * @param {float} height The height of this page, px.
   * @param {*} textContent A list of text boxes on this page (from page.getTextContent().items).
   * to use.
   */
  constructor(pageContainer, pageNum, currentPageSupplier, pdfCanvas, width, height, textContent) {
    // Init default values
    this.#idx = pageNum;
    this.#width = width;
    this.#height = height;
    this.#currentPageSupplier = currentPageSupplier;

    // Init what is known about the table
    this.#columnWidths = Array(DEFAULT_COLS).fill(DEFAULT_COL_SIZE);
    this.#tableWidth = DEFAULT_COLS * DEFAULT_COL_SIZE;
    this.#rowHeights = [DEFAULT_TABLE_HEIGHT];
    this.#tableHeight = DEFAULT_TABLE_HEIGHT;
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
    this.#interactiveLayer = new InteractiveLayer(this);
    this.forceRedraw();
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
   * Detaches all event listeners, removes all elements.
   */
  destroy() {
    this.#interactiveLayer.detach();
    this.#canvasContainer.remove();
  }

  // MARK: Appearance
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

  // MARK: Table properties
  /**
   * Clamps and sets the position of this table to a new position relative to the top left corner
   * of the page. Does not redraw.
   * @param {float} x The x position of the table.
   * @param {float} y The y position of the table.
   */
  setPosition(x, y) {
    // Clamp to page edges
    this.#tableCoords[0] = clamp(x, 0, this.width - this.tableWidth);
    this.#tableCoords[1] = clamp(y, 0, this.height - this.tableHeight);
  }

  /**
   * Clamps and sets the width of a column of this table. Does not redraw.
   * @param {int} col The index of the column to set.
   * @param {float} width The width of the column, px.
   * @return The clamped width, px.
   */
  setColumnWidth(col, width) {
    width = clamp(width, MIN_COL_SIZE, this.width - this.tableX - this.tableWidth + this.getColWidth(col));;
    let delta = width - this.getColWidth(col);
    this.#tableWidth += delta;
    this.#columnWidths[col] = width;
  }

  /**
   * Clamps and sets the height of the table. Resets all the row heights. Does not redraw.
   * @param {float} height The height of the entire table.
   */
  setTableHeight(height) {
    height = clamp(height, MIN_TABLE_HEIGHT, this.height - this.tableY);

    // Drop all the rows in this table.
    this.#tableHeight = height;
    this.#rowHeights = [height];
  }

  /**
   * Clamps and sets a new number of columns for this page. Does not redraw.
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

    return newColCount;
  }

  // MARK: Table actions
  /**
   * Forces the interactive layer to stop dragging and redraw. Does redraw.
   */
  forceRedraw() {
    this.#interactiveLayer.stopDragging();
    this.#interactiveLayer.redraw();
  }

  /**
   * Auto detects rows in the table. This is done by looking at each of y positions of the text
   * boxes in the index (first) column. Does redraw.
   */
  detectRows() {
    // TODO fix
    let indexRowStop = this.tableX + this.getColWidth(0);
    let rowYPos = [];

    // Get the y position of each word in index row
    for (const word of this.#words) {
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

  /**
   * Attempts to copy the table layout of another page. Does redraw.
   * @param {Page} template The page to copy from. 
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

    // Add height
    this.setTableHeight(template.tableHeight);

    // Redraw
    this.forceRedraw();
  }

  // MARK: CSV Formatting
  /**
   * Converts the words on this page into a csv file format with the specified number of columns.
   * @param {int} columns The number of columns in the full csv file.
   * @returns This table's CSV data.
   */
  getCSV(columns) {
    // TODO
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

  // MARK: Getters
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
    return this.#rowHeights.length;
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
    return this.#tableHeight;
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
  getRowHeight(row) {
    return this.#rowHeights[row];
  }

  /**
   * Gets the number of pages between this page and the page at the center of the viewport.
   */
  get pagesFromViewport() {
    return Math.abs(this.#currentPageSupplier() - this.#idx);
  }
}
