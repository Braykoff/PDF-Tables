import { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api.js";
import { DEFAULT_COLS, MIN_COL_SIZE } from "./constants.js";
import { InteractiveLayer } from "./interactive-layer.js";
import { MessageBox } from "./message-box.js";
import { getWord, renderPDFOntoCanvas, Word } from "./pdf-wrapper.js";
import { clamp, clampedBy, get2dCanvasContext, isStringEmpty, Pos } from "./utils.js";

// MARK: Constants
/** Max number of columns. */
const MAX_COLS: number = 50;

/** Default column size, px. */
const DEFAULT_COL_SIZE: number = 25;

/** Default height of a table, px. */
const DEFAULT_TABLE_HEIGHT: number = 40;

/** Minimum height of a table, px. */
const MIN_TABLE_HEIGHT: number = 2;

/** Radius of the circles representing text boxes. */
const TEXT_BOX_RADIUS: number = 2;

/** Color of the circles representing text boxes. */
const TEXT_BOX_COLOR: string = "red";

/**
 * Checks if a cell in a CSV table needs escaping, and escapes it if it does.
 * @param cell The content of a single CSV cell to check.
 * @returns The escaped cell, in CSV format.
 */
function escapeCSV(cell: string): string {
  if (cell.includes(",") || cell.includes("\n") || cell.includes("\"")) {
    return `"${cell.replaceAll("\"", "\"\"")}"`;
  } else {
    return cell;
  }
}

/**
 * Checks whether a given row (list of strings) is all empty.
 * @param row The row to check.
 * @returns True if row empty, false otherwise.
 */
function isRowEmpty(row: string[]): boolean {
  for (const r of row) {
    if (!isStringEmpty(r)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if an object is a TextItem.
 * @param obj The object to check.
 * @returns Whether the object is a TextItem.
 */
function isTextItem(obj: TextItem | TextMarkedContent): obj is TextItem {
  return Object.hasOwn(obj, "str");
}

/**
 * Represents a single PDF page, with tables and text box annotations.
 */
export class Page {
  // MARK: Properties
  // Page properties
  private _idx: number;
  private _width: number;
  private _height: number;
  private _words: Word[];
  private _zoom!: number;

  // Page elements
  private _canvasContainer: HTMLDivElement;
  private _wordCanvas: HTMLCanvasElement;
  private _interactiveLayer: InteractiveLayer;

  // Table properties
  private _columnWidths: number[] = Array(DEFAULT_COLS).fill(DEFAULT_COL_SIZE);
  private _tableWidth: number = DEFAULT_COLS * DEFAULT_COL_SIZE;
  private _rowHeights: number[] = [DEFAULT_TABLE_HEIGHT];
  private _tableHeight: number = DEFAULT_TABLE_HEIGHT;
  private _tableCoords: Pos = { x: 5, y: 5 };  
  private _indexColumn: number = 0;
  /** Combined width of all columns to the left of the index column, px. */
  private _leftOfIndex: number = 0;

  // MARK: Construction
  /**
   * Creates a Page object. Use the async .create(...) method instead.
   * @param pageContainer The element containing all the pages.
   * @param pageNum This page's index (starting at 1).
   * @param pdfCanvas The canvas with this page drawn on it.
   * @param width The width of this page, px.
   * @param height The height of this page, px.
   * @param textContent A list of text boxes on this page (from page.getTextContent().items). to 
   * use.
   * @param messageBox The message box to display info on.
   */
  constructor(
    pageContainer: HTMLDivElement, 
    pageNum: number, 
    pdfCanvas: HTMLCanvasElement, 
    width: number, 
    height: number, 
    textContent: (TextItem | TextMarkedContent)[],
    messageBox: MessageBox,
  ) {
    // Init default values
    this._idx = pageNum;
    this._width = width;
    this._height = height;

    // Create page container
    this._canvasContainer = document.createElement("div");
    this._canvasContainer.classList.add("page");
    pageContainer.appendChild(this._canvasContainer);

    this.setZoom(1.0); // Sets width, height, and _zoom.

    // Add PDF canvas
    this._canvasContainer.appendChild(pdfCanvas);

    // Create word canvas
    this._wordCanvas = document.createElement("canvas");
    this._wordCanvas.width = width;
    this._wordCanvas.height = height;

    this._wordCanvas.classList.add("wordCanvas");
    this._canvasContainer.appendChild(this._wordCanvas);

    // Render words onto word canvas
    const wordCtx: CanvasRenderingContext2D = get2dCanvasContext(this._wordCanvas);
    wordCtx.fillStyle = TEXT_BOX_COLOR;

    this._words = [];

    for (const text of textContent) {
      if (isTextItem(text) && !isStringEmpty(text.str)) {
        const word: Word = getWord(text, height);
        this._words.push(word);

        // Render on canvas
        wordCtx.beginPath();
        wordCtx.arc(word.pos.x, word.pos.y, TEXT_BOX_RADIUS, 0, 2 * Math.PI);
        wordCtx.fill();
      }
    }

    // Sort word list left-to-right, top-to-bottom
    this._words.sort((a: Word, b: Word) => {
      if (a.pos.y !== b.pos.y) { return a.pos.y - b.pos.y; }
      return a.pos.x - b.pos.x;
    });

    // Init interactive layer
    this._interactiveLayer = new InteractiveLayer(this, messageBox);
    this.forceRedraw();
  }

  /**
   * Create a new page.
   * @param pageContainer The element containing all the pages.
   * @param messageBox The message box to display info on.
   * @param pdf PDF object returned by PDF.JS.
   * @param pageNum Page number (starting at 1).
   * @returns A Page object for this page.
   */
  static async create(
    pageContainer: HTMLDivElement, 
    messageBox: MessageBox, 
    pdf: PDFDocumentProxy, 
    pageNum: number,
  ): Promise<Page> {
    // Await page, info
    const [canvas, page, width, height]: [HTMLCanvasElement, PDFPageProxy, number, number] = 
      await renderPDFOntoCanvas(pdf, pageNum);

    // Await words
    const textContent: (TextItem | TextMarkedContent)[] = (await page.getTextContent()).items;

    // Pass off to constructor
    return new this(pageContainer, pageNum, canvas, width, height, textContent, messageBox);
  }

  /**
   * Detaches all event listeners, removes all elements.
   */
  destroy(): void {
    this._interactiveLayer.detach();
    this._canvasContainer.remove();
  }

  // MARK: Appearance
  /**
   * Sets whether the text boxes are shown or not.
   * @param shown Whether the text boxes are shown or not.
   */
  setTextboxesShown(shown: boolean): void {
    this._wordCanvas.style.visibility = shown ? "visible" : "hidden";
  }

  /**
   * Add a new canvas for this page.
   * @param canvas The canvas to add.
   */
  addCanvas(canvas: HTMLCanvasElement): void {
    this._canvasContainer.appendChild(canvas);
  }

  /**
   * Sets the page to a specific cursor.
   * @param cursor The CSS cursor to set to.
   */
  setCursor(cursor: string): void {
    this._canvasContainer.style.cursor = cursor;
  }

  /**
   * Zooms the page in/out.
   * @param zoom The zoom to set to, %.
   */
  setZoom(zoom: number): void {
    this._zoom = zoom;
    this._canvasContainer.style.width = `${this.width * zoom}px`;
    this._canvasContainer.style.height = `${this.height * zoom}px`;
  }

  // MARK: Table properties
  /**
   * Clamps and sets the position of this table to a new position relative to the top left corner
   * of the page. Does not redraw.
   * @param x The x position of the table.
   * @param y The y position of the table.
   */
  setPosition(x: number, y: number): void {
    // Clamp to page edges
    this._tableCoords.x = clamp(x, 0, this.width - this.tableWidth);
    this._tableCoords.y = clamp(y, 0, this.height - this.tableHeight);
  }

  /**
   * Clamps and sets the width of a column of this table. Does not redraw.
   * @param col The index of the column to set.
   * @param width The width of the column, px.
   */
  setColumnWidth(col: number, width: number): void {
    width = clamp(
      width, MIN_COL_SIZE, this.width - this.tableX - this.tableWidth + this.getColWidth(col));

    const delta: number = width - this.getColWidth(col);
    this._tableWidth += delta;
    this._columnWidths[col] = width;

    // Effects index column position
    if (col < this._indexColumn) {
      this._leftOfIndex += delta;
    }
  }

  /**
   * Clamps and sets the height of the table. Resets all the row heights. Does not redraw.
   * @param height The height of the entire table.
   */
  setTableHeight(height: number): void {
    height = clamp(height, MIN_TABLE_HEIGHT, this.height - this.tableY);

    // Drop all the rows in this table.
    this._tableHeight = height;
    this._rowHeights = [height];
  }

  /**
   * Clamps and sets a new number of columns for this page. Does not redraw.
   * @param newColCount The new number of columns.
   * @returns The clamped number of columns.
   */
  setColumnCount(newColCount: number): number {
    newColCount = clamp(newColCount, 1, MAX_COLS);

    if (newColCount === this.colCount) {
      // No change in column count
      return newColCount;
    } else if (newColCount < this.colCount) {
      // Check that index column is still here
      if (newColCount <= this._indexColumn) {
        this.setIndexColumn(newColCount - 1);
      }

      // Columns removed
      while (this._columnWidths.length > newColCount) {
        // The below is safe because this._columnWidths.length > newColCount >= 1
        this._tableWidth -= this._columnWidths.pop()!;
      }
    } else {
      // Columns added
      let colDelta: number = newColCount - this.colCount;
      const spaceOnLeft: number = this.width - this.tableX - this._tableWidth;

      if (colDelta * DEFAULT_COL_SIZE <= spaceOnLeft) {
        // Fits perfectly
        this._columnWidths.push(...Array(colDelta).fill(DEFAULT_COL_SIZE));
        this._tableWidth += colDelta * DEFAULT_COL_SIZE;
      } else if (spaceOnLeft / colDelta >= MIN_COL_SIZE) {
        // Fits with resizing below default
        this._columnWidths.push(...Array(colDelta).fill(spaceOnLeft / colDelta));
        this._tableWidth += spaceOnLeft;
      } else if ((spaceOnLeft + this.tableX) / colDelta >= MIN_COL_SIZE) {
        // Fits with moving table to the left and below default
        this.setPosition(
          this.tableX - (colDelta - (spaceOnLeft / MIN_COL_SIZE)) * MIN_COL_SIZE, this.tableY);
        this._columnWidths.push(...Array(colDelta).fill(MIN_COL_SIZE));
        this._tableWidth += colDelta *= MIN_COL_SIZE;
      } else {
        // Doesn't even fit with moving the table, just cut columns
        return this.setColumnCount(
          this.colCount + Math.floor((spaceOnLeft + this.tableX) / MIN_COL_SIZE));
      }
    }

    return newColCount;
  }

  // MARK: Table actions
  /**
   * Sets the column used for row detection. Does not redraw.
   * @param col The index of the new column used for indexing.
   */
  setIndexColumn(col: number): void {
    this._indexColumn = clamp(col, 0, this.colCount - 1);

    // Recompute space to the left of the column
    this._leftOfIndex = 0;

    for (let c: number = 0; c < this._indexColumn; c++) {
      this._leftOfIndex += this.getColWidth(c);
    }
  }

  /**
   * Forces the interactive layer to stop dragging and redraw. Does redraw.
   */
  forceRedraw(): void {
    this._interactiveLayer.stopDragging();
    this._interactiveLayer.redraw();
  }

  /**
   * Auto detects rows in the table. This is done by looking at each of y positions of the text
   * boxes in the index (first) column. Does redraw.
   */
  detectRows(): void {
    const indexRowStart: number = this.tableX + this.leftOfIndex;
    let cumHeight: number = 0;
    let textToUpperBorder: number = -1;

    this._rowHeights = [];

    // Get the y position of each word in index row
    for (const word of this._words) {
      if (
        clampedBy(word.pos.x, indexRowStart, indexRowStart + this.indexColWidth) &&
        clampedBy(word.pos.y, this.tableY, this.tableY + this._tableHeight)
      ) {
        // Word is in index row
        if (textToUpperBorder === -1) {
          // This is the first one
          textToUpperBorder = word.pos.y - this.tableY;
        } else {
          // Use word y pos for previous row's height
          const h: number = word.pos.y - this.tableY - cumHeight - textToUpperBorder;
          cumHeight += h;
          this._rowHeights.push(h);
        }
      }
    }

    // Push last row with remaining height
    this._rowHeights.push(this._tableHeight - cumHeight);

    // Redraw
    this.forceRedraw();
  }

  /**
   * Attempts to copy the table layout of another page. Does redraw.
   * @param template The page to copy from. 
   */
  copyFrom(template: Page): void {
    this.setPosition(template.tableX, template.tableY);

    // Add columns
    this._columnWidths = [];
    this._tableWidth = 0;

    for (let c: number = 0; c < template.colCount; c++) {
      this.setColumnCount(c + 1);
      this.setColumnWidth(c, template.getColWidth(c));
    }

    // Add height
    this.setTableHeight(template.tableHeight);

    // Add index column
    this.setIndexColumn(template.indexCol);

    // Redraw
    this.forceRedraw();
  }

  // MARK: CSV Formatting
  /**
   * Converts the words on this page into a csv file format with the specified number of columns.
   * @param columns The number of columns in the full csv file.
   * @returns This table's CSV data.
   */
  getCSV(columns: number): string {
    if (columns < this.colCount) {
      throw "Not enough columns!";
    }

    // We will assume that all indexes of this are not undefined.
    const table: string[][] = Array.from(Array(this.rowCount), () => new Array(columns).fill(""));

    // Add each word
    for (const word of this._words) {
      // Check not too far left/up
      if (word.pos.x < this.tableX || word.pos.y < this.tableY) { continue; }

      // Determine which column this word is in
      let colIdx: number = -1;
      let cumLength: number = 0;

      for (let c: number = 0; c < this.colCount; c++) {
        cumLength += this.getColWidth(c);

        if (word.pos.x < this.tableX + cumLength) {
          colIdx = c;
          break;
        }
      }

      // Determine which row this word is in
      let rowIdx: number = -1;
      cumLength = 0;

      for (let r: number = 0; r < this.rowCount; r++) {
        cumLength += this.getRowHeight(r);

        if (word.pos.y < this.tableY + cumLength) {
          rowIdx = r;
          break;
        }
      }

      // Check if inside table
      if (colIdx === -1 || rowIdx === -1) { continue; }

      // Add to table
      table[rowIdx]![colIdx] += word.content;
    }

    // Ensure not empty
    if (this.rowCount === 0 || (this.rowCount === 1 && isRowEmpty(table[0] ?? [""]))) {
      return "";
    }

    // Format into csv format
    const formattedRows: string[] = Array(this.rowCount).fill("");

    for (let r: number = 0; r < this.rowCount; r++) {
      // Escape each value in the row
      for (let c: number = 0; c < columns; c++) {
        table[r]![c] = escapeCSV(table[r]![c]!);
      }

      formattedRows[r] = table[r]!.join(",");
    }

    return formattedRows.join("\n");
  }

  // MARK: Getters
  /**
   * Determines the number of words bounded by the given box.
   * @param pos1 The first coordinate.
   * @param pos2 The second coordinate.
   * @returns The number of words bounded by this box.
   */
  getWordsBoundedBy(pos1: Pos, pos2: Pos): number {
    // Verify inputs are in correct order
    const [x1, x2]: number[] = [pos1.x, pos2.x].sort((a: number, b: number) => a - b);
    const [y1, y2]: number[] = [pos1.y, pos2.y].sort((a: number, b: number) => a - b);

    // Count words
    let wordCount: number = 0;

    for (const word of this._words) {
      // The following is safe because we know x1, x2, y1, and y2 exist
      if (clampedBy(word.pos.x, x1!, x2!) && clampedBy(word.pos.y, y1!, y2!)) {
        wordCount += 1;
      }
    }

    return wordCount;
  }

  /**
   * @returns width of this page, px.
   */
  get width(): number {
    return this._width;
  }

  /**
   * @returns height of this page, px.
   */
  get height(): number {
    return this._height;
  }

  /**
   * @returns The current page's bounding client rect (position relative to user's viewport).
   */
  get boundingClientRect(): DOMRect {
    return this._canvasContainer.getBoundingClientRect();
  }

  /**
   * @returns The distance between this page and the user's viewport center, px.
   */
  get distToCenter(): number {
    const rect: DOMRect = this.boundingClientRect;
    return Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2);
  }

  /**
   * @returns The zoom, %.
   */
  get zoom(): number {
    return this._zoom;
  }

  /**
   * @returns The index of this page (starting at 1).
   */
  get index(): number {
    return this._idx;
  }

  /**
   * @returns The number of rows in this page's table.
   */
  get rowCount(): number {
    return this._rowHeights.length;
  }

  /**
   * @returns The number of cols in this page's table.
   */
  get colCount(): number {
    return this._columnWidths.length;
  }

  /**
   * @returns Gets the x coordinate of the top-left corner of the table, relative to the page.
   */
  get tableX(): number {
    return this._tableCoords.x;
  }

  /**
   * @returns The y coordinate of the top-left corner of the table, relative to the page.
   */
  get tableY(): number {
    return this._tableCoords.y;
  }

  /**
   * @returns The total table width, px.
   */
  get tableWidth(): number {
    return this._tableWidth;
  }

  /**
   * @returns The total table height, px.
   */
  get tableHeight(): number {
    return this._tableHeight;
  }

  /**
   * Gets the width of a certain column
   * @param col The index of the column.
   * @returns The width of the column, px.
   */
  getColWidth(col: number): number {
    if (!clampedBy(col, 0, this._columnWidths.length)) {
      throw new Error(`Column out of bounds: ${  col}`);
    }

    return this._columnWidths[col]!;
  }

  /**
   * Gets the height of a certain row.
   * @param row The index of the row.
   * @returns The height of the row, px.
   */
  getRowHeight(row: number): number {
    if (!clampedBy(row, 0, this._rowHeights.length)) {
      throw new Error(`Row out of bounds: ${  row}`);
    }

    return this._rowHeights[row]!;
  }

  /**
   * @returns The column index used as the index for row detection.
   */
  get indexCol(): number {
    return this._indexColumn;
  }

  /**
   * @returns The width of the index column, px.
   */
  get indexColWidth(): number {
    return this.getColWidth(this._indexColumn);
  }

  /**
   * @returns The combined width of all columns to the left of the index column, px.
   */
  get leftOfIndex(): number {
    return this._leftOfIndex;
  }
}
