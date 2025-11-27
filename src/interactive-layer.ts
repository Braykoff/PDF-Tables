import {
  MIN_COL_SIZE, TABLE_SCALE_FACTOR, ACTIVE_TABLE_COLOR,
  NORMAL_TABLE_COLOR,
} from "./constants.js";
import { IndexLabel } from "./index-label.js";
import { Page } from "./page.js";
import { clamp, clampedBy, EMPTY_POS, get2dCanvasContext, isNear, Pos } from "./utils.js";

// MARK: Constants
/** Default table border width, px */
const NORMAL_TABLE_BORDER_WIDTH: number = 1.5;

/** Table border width while interacting, px. */
const ACTIVE_TABLE_BORDER_WIDTH: number = 4;

/** Distance cursor can be from element to still be "hovering", px. */
const TABLE_HOVER_BUFFER: number = 2;

/** Describes what is being dragged currently. */
enum DragItem {
  NONE = -1, // No active drag item
  COL, // Dragging a column border (vertical line)
  ROW, // Dragging a row border (horizontal line)
  WHOLE, // Dragging whole table
  SELECTION_BOX, // Dragging a selection box
  INDEX, // Dragging the indexer
}

/** Describe the state  */
enum DragState {
  NONE = -1, // Nothing active
  HOVER, // Being hovered
  DRAGGING, // Actively dragging
}

/**
 * Determines the cursor depending on the drag item.
 * @param item The drag item.
 * @returns The CSS cursor.
 */
function cursorForDragItem(item: DragItem): string {
  switch (item) {
  case DragItem.COL:
  case DragItem.INDEX:
    return "col-resize";
  case DragItem.ROW:
    return "row-resize";
  case DragItem.WHOLE:
    return "move";
  case DragItem.SELECTION_BOX:
    return "crosshair";
  default:
    return "";
  }
}

/** A type for mouse event listener functions. */
type MouseEventHandler = (event: MouseEvent) => void;

/**
 * Represents the interactive components of a page.
 */
export class InteractiveLayer {
  // MARK: Construction
  private _page: Page;
  private _ctx: CanvasRenderingContext2D;
  private _bottomBar: HTMLDivElement;
  private _bottomBarContent: HTMLSpanElement;
  private _indexLabel: IndexLabel;

  private _activeItem: DragItem = DragItem.NONE;
  /** index of the object being dragged. */
  private _activeIdx: number = -1;
  private _state: DragState = DragState.NONE;
  /** Coordinate of mouse relative to page first while dragging. */
  private _firstMousePos: Pos = EMPTY_POS;
  /** Coordinate of mouse relative to page at last move while dragging. */
  private _lastMousePos: Pos = EMPTY_POS;

  /** Detaches all event listeners. */
  detach: () => void;

  /**
   * Creates a DraggableTable object.
   * @param page The page object for this table.
   * @param bottomBar The HTML bottom bar containing div.
   * @param bottomBarContent The HTML bottom bar text span.
   */
  constructor(page: Page, bottomBar: HTMLDivElement, bottomBarContent: HTMLSpanElement) {
    this._page = page;
    this._bottomBar = bottomBar;
    this._bottomBarContent = bottomBarContent;

    // Create our canvas
    const canvas: HTMLCanvasElement = document.createElement("canvas");
    canvas.width = page.width * TABLE_SCALE_FACTOR;
    canvas.height = page.height * TABLE_SCALE_FACTOR;
    canvas.classList.add("tableCanvas");
    page.addCanvas(canvas);

    this._ctx = get2dCanvasContext(canvas);

    // Create our index label handler
    this._indexLabel = new IndexLabel(this._page, this._ctx);

    // Init listeners
    const mouseMoveListener: MouseEventHandler = this._mouseMove.bind(this);
    const mouseDownListener: MouseEventHandler = this._mouseDown.bind(this);
    const mouseUpListener:  MouseEventHandler = this.stopDragging.bind(this);

    document.addEventListener("mousemove", mouseMoveListener);
    canvas.addEventListener("mousedown", mouseDownListener);
    document.addEventListener("mouseup", mouseUpListener);

    // Create function to remove event listeners
    /**
     *
     */
    this.detach = function (): void {
      document.removeEventListener("mousemove", mouseMoveListener);
      canvas.removeEventListener("mousedown", mouseDownListener);
      document.removeEventListener("mouseup", mouseUpListener);
    };
  }

  // MARK: Mouse detection
  /**
   * Converts an event's mouse coordinates to coordinates on the page.
   * @param evt The event to use.
   * @returns x, y coordinates relative to the top left of the page.
   */
  private _getMousePosOnPage(evt: MouseEvent): Pos {
    const rect: DOMRect = this._page.boundingClientRect;
    return {
      x: (evt.clientX - rect.x) / this._page.zoom,
      y: (evt.clientY - rect.y) / this._page.zoom,
    };
  }

  /**
   * Determines if the mouse is hovering over any part of the table, and returns the type/index of
   * the element being hovered.
   * @param mousePos The position of the mouse relative to the top left corner of the page.
   * @returns The type and index of the component being hovered, or null if not being 
   * hovered.
   */
  private _getIsHovering(mousePos: Pos): [DragItem, number] | null {
    // Check if hovering index column label
    if (this._indexLabel.isWithinLabel(mousePos.x, mousePos.y)) {
      return [DragItem.INDEX, 0];
    }

    // Bottom right corner of table
    const brCorner: [number, number] =
      [this._page.tableX + this._page.tableWidth, this._page.tableY + this._page.tableHeight];

    if (
      !clampedBy(
        mousePos.x,this._page.tableX - TABLE_HOVER_BUFFER, brCorner[0] + TABLE_HOVER_BUFFER) || 
      !clampedBy(
        mousePos.y, this._page.tableY - TABLE_HOVER_BUFFER, brCorner[1] + TABLE_HOVER_BUFFER)
    ) {
      // Not within table bounds
      return null;
    }

    // Check if intercepting top or bottom row (horizontal) lines
    if (isNear(mousePos.y, this._page.tableY, TABLE_HOVER_BUFFER)) {
      // Intercepting top row line
      return [DragItem.ROW, 0];
    } else if (isNear(mousePos.y, brCorner[1], TABLE_HOVER_BUFFER)) {
      // Intercepting bottom row line
      return [DragItem.ROW, this._page.rowCount];
    }

    // Check if intercepting column (vertical) lines
    let cumWidth: number = 0;

    for (let c: number = 0; c <= this._page.colCount; c++) {
      const x: number = this._page.tableX + cumWidth;

      if (isNear(mousePos.x, x, TABLE_HOVER_BUFFER)) {
        // Intercepting this column line
        return [DragItem.COL, c];
      }

      // Accumulate column widths
      if (c !== this._page.colCount) {
        cumWidth += this._page.getColWidth(c);
      }
    }

    // Intercepting table but no lines
    return [DragItem.WHOLE, 0];
  }

  // MARK: Events
  /**
   * Handler for mouse move. Handles drag, hover logic.
   * @param evt Event.
   */
  private _mouseMove(evt: MouseEvent): void {
    // Get mouse relative to page 
    const pos: Pos = this._getMousePosOnPage(evt);

    if (this._state === DragState.DRAGGING) {
      // We are actively being dragged
      const deltas: Pos = { x: pos.x - this._lastMousePos.x, y: pos.y - this._lastMousePos.y };

      switch (this._activeItem) {
      case DragItem.COL: {
        // A column is being dragged left/right
        if (this._activeIdx === 0) {
          // The first border is being dragged left, need to adjust the table's x position
          const clampedDeltaX: number =
              clamp(deltas.x, -this._page.tableX, this._page.getColWidth(0) - MIN_COL_SIZE);

          this._page.setPosition(this._page.tableX + clampedDeltaX, this._page.tableY);
          this._page.setColumnWidth(0, this._page.getColWidth(0) - clampedDeltaX);
        } else {
          // Simply add to its width
          const idx: number = this._activeIdx - 1;
          this._page.setColumnWidth(idx, this._page.getColWidth(idx) + deltas.x);
        }
        break;
      }
      case DragItem.ROW: {
        // A row is being dragged up/down
        if (this._activeIdx === 0) {
          // The top border is being dragged up, need to adjust the table's y position
          this._page.setPosition(this._page.tableX, this._page.tableY + deltas.y);
          this._page.setTableHeight(this._page.tableHeight - deltas.y);
        } else {
          // The bottom border is being dragged down
          this._page.setTableHeight(this._page.tableHeight + deltas.y);
        }
        break;
      }
      case DragItem.WHOLE: {
        // The whole table is being dragged
        this._page.setPosition(this._page.tableX + deltas.x, this._page.tableY + deltas.y);
        break;
      }
      case DragItem.SELECTION_BOX: {
        // A selection box is being made
        // Determine the number of words intercepted
        const wordCount: number = this._page.getWordsBoundedBy(this._firstMousePos, pos);
        this._bottomBarContent.innerText =
            `${wordCount} textbox${wordCount === 1 ? "" : "es"} selected`;
        this._bottomBar.style.visibility = "visible";

        break;
      }
      case DragItem.INDEX: {
        // The index column is being moved
        this._indexLabel.setDrag(deltas.x);
        break;
      }
      }

      this._lastMousePos = pos;
      this.redraw();
    } else if (clampedBy(pos.x, 0, this._page.width) && clampedBy(pos.y, 0, this._page.height)) {
      // Check hovering?
      const hover: [DragItem, number] | null = this._getIsHovering(pos);

      if (hover === null) {
        // Nothing hovering
        this._setStateAndLazyRedraw(DragState.NONE, DragItem.NONE, -1);
      } else {
        // Something is being hovered
        this._setStateAndLazyRedraw(DragState.HOVER, hover[0], hover[1]);
      }
    }
  }

  /**
   * Handler for mouse down.
   * @param evt Event.
   */
  private _mouseDown(evt: MouseEvent): void {
    this._firstMousePos = this._getMousePosOnPage(evt);
    this._lastMousePos = this._firstMousePos;

    if (this._state === DragState.HOVER) {
      // Hovering, switch to dragging
      this._setStateAndLazyRedraw(DragState.DRAGGING, this._activeItem, this._activeIdx);
    } else if (this._state === DragState.NONE) {
      // Not hovering, switch to selection box
      this._setStateAndLazyRedraw(DragState.DRAGGING, DragItem.SELECTION_BOX, 0);
    }
  }

  /**
   * Stops all dragging, lazily redrawing the table.
   */
  stopDragging(): void {
    this._bottomBar.style.visibility = "hidden";
    this._indexLabel.stopDragging();

    this._setStateAndLazyRedraw(DragState.NONE, DragItem.NONE, -1);
  }

  // MARK: Redraw
  /**
   * Sets the state, redrawing only if the state has changed.
   * @param newState The new state to use.
   * @param newItem The new drag item to use.
   * @param newIdx The new drag index to use.
   */
  private _setStateAndLazyRedraw(newState: DragState, newItem: DragItem, newIdx: number): void {
    const needsRedraw: boolean =
      (newState !== this._state || newItem !== this._activeItem || newIdx !== this._activeIdx);

    this._state = newState;
    this._activeItem = newItem;
    this._activeIdx = newIdx;

    if (needsRedraw) { this.redraw(); }
  }

  /**
   * Redraws the entire table.
   */
  redraw(): void {
    // Clear
    this._ctx.reset();

    // Draw index label
    this._indexLabel.redraw();

    // Draw horizontal (row) lines
    let cumHeight: number = 0;

    for (let r: number = 0; r <= this._page.rowCount; r++) {
      let y: number = this._page.tableY + cumHeight;
      y *= TABLE_SCALE_FACTOR;

      // Set stroke style
      const active: boolean = 
        this._state >= 0 && this._activeItem === DragItem.ROW && this._activeIdx === r;
      this._ctx.lineWidth =
        (active ? ACTIVE_TABLE_BORDER_WIDTH : NORMAL_TABLE_BORDER_WIDTH) * TABLE_SCALE_FACTOR;
      this._ctx.strokeStyle = active ? ACTIVE_TABLE_COLOR : NORMAL_TABLE_COLOR;

      // Draw line
      this._ctx.beginPath();
      this._ctx.moveTo(this._page.tableX * TABLE_SCALE_FACTOR, y);
      this._ctx.lineTo((this._page.tableX + this._page.tableWidth) * TABLE_SCALE_FACTOR, y);
      this._ctx.stroke();

      // Accumulate the height
      if (r !== this._page.rowCount) {
        cumHeight += this._page.getRowHeight(r);
      }
    }

    // Draw vertical (column lines)
    let cumWidth: number = 0;

    for (let c: number = 0; c <= this._page.colCount; c++) {
      let x: number = this._page.tableX + cumWidth;
      x *= TABLE_SCALE_FACTOR;

      // Set stroke style
      const active: boolean = 
        this._state >= 0 && this._activeItem === DragItem.COL && this._activeIdx === c;
      this._ctx.lineWidth =
        (active ? ACTIVE_TABLE_BORDER_WIDTH : NORMAL_TABLE_BORDER_WIDTH) * TABLE_SCALE_FACTOR;
      this._ctx.strokeStyle = active ? ACTIVE_TABLE_COLOR : NORMAL_TABLE_COLOR;

      // Draw line
      this._ctx.beginPath();
      this._ctx.moveTo(x, this._page.tableY * TABLE_SCALE_FACTOR);
      this._ctx.lineTo(x, (this._page.tableY + this._page.tableHeight) * TABLE_SCALE_FACTOR);
      this._ctx.stroke();

      // Accumulate the width across
      if (c !== this._page.colCount) {
        cumWidth += this._page.getColWidth(c);
      }
    }

    // Draw selection box
    if (this._state === DragState.DRAGGING && this._activeItem === DragItem.SELECTION_BOX) {
      this._ctx.globalAlpha = 0.4;
      this._ctx.fillStyle = "gray";
      this._ctx.fillRect(
        this._firstMousePos.x * TABLE_SCALE_FACTOR,
        this._firstMousePos.y * TABLE_SCALE_FACTOR,
        (this._lastMousePos.x - this._firstMousePos.x) * TABLE_SCALE_FACTOR,
        (this._lastMousePos.y - this._firstMousePos.y) * TABLE_SCALE_FACTOR,
      );
      this._ctx.globalAlpha = 1;
    }

    // Set pointer
    this._page.setCursor(cursorForDragItem(this._activeItem));
  }
}
