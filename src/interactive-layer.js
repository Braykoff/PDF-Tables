import {
  MIN_COL_SIZE, TABLE_SCALE_FACTOR, ACTIVE_TABLE_COLOR,
  NORMAL_TABLE_COLOR,
} from "./constants.js";
import { IndexLabel } from "./index-label.js";
import { clampedBy, clamp, isNear } from "./utils.js";

// MARK: Constants

/** Default table border width, px */
const NORMAL_TABLE_BORDER_WIDTH = 1.5;

/** Table border width while interacting, px. */
const ACTIVE_TABLE_BORDER_WIDTH = 4;

/** Distance cursor can be from element to still be "hovering", px. */
const TABLE_HOVER_BUFFER = 2;

/** Describes what is being dragged currently. */
const DragItem = {
  NONE: -1, // No active drag item
  COL: 0, // Dragging a column border (vertical line)
  ROW: 1, // Dragging a row border (horizontal line)
  WHOLE: 2, // Dragging whole table
  SELECTION_BOX: 3, // Dragging a selection box
  INDEX: 4, // Dragging the indexer
};

/** Describe the state  */
const DragState = {
  NONE: -1, // Nothing active
  HOVER: 0, // Being hovered
  DRAGGING: 1, // Actively dragging
};

/**
 * Determines the cursor depending on the drag item.
 * @param {DragItem} item The drag item.
 * @returns The CSS cursor.
 */
function cursorForDragItem(item) {
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

/**
 * Represents the interactive components of a page.
 */
export class InteractiveLayer {
  // MARK: Construction
  #page = undefined;
  #ctx = undefined;
  #bottomBar = undefined;
  #bottomBarContent = undefined;

  #activeItem = DragItem.NONE;
  #activeIdx = -1; // index of the object being dragged
  #state = DragState.NONE;
  #firstMousePos = undefined; // Coordinate of mouse relative to page first while dragging
  #lastMousePos = undefined; // Coordinate of mouse relative to page at last move while dragging.
  #indexLabel = undefined;

  /**
   * Creates a DraggableTable object.
   * @param {BasePage} page The page object for this table.
   * @param {Element} bottomBar The HTML bottom bar containing div.
   * @param {Element} bottomBarContent The HTML bottom bar text span.
   */
  constructor(page, bottomBar, bottomBarContent) {
    this.#page = page;
    this.#bottomBar = bottomBar;
    this.#bottomBarContent = bottomBarContent;

    // Create our canvas
    const canvas = document.createElement("canvas");
    canvas.width = page.width * TABLE_SCALE_FACTOR;
    canvas.height = page.height * TABLE_SCALE_FACTOR;
    canvas.classList.add("tableCanvas");
    page.addCanvas(canvas);

    this.#ctx = canvas.getContext("2d");

    // Create our index label handler
    this.#indexLabel = new IndexLabel(this.#page, this.#ctx);

    // Init listeners
    const mouseMoveListener = this.#mouseMove.bind(this);
    const mouseDownListener = this.#mouseDown.bind(this);
    const mouseUpListener = this.stopDragging.bind(this);

    document.addEventListener("mousemove", mouseMoveListener);
    canvas.addEventListener("mousedown", mouseDownListener);
    document.addEventListener("mouseup", mouseUpListener);

    // Create function to remove event listeners
    /** Detaches all event listeners. */
    this.detach = function () {
      document.removeEventListener("mousemove", mouseMoveListener);
      canvas.removeEventListener("mousedown", mouseDownListener);
      document.removeEventListener("mouseup", mouseUpListener);
    };
  }

  // MARK: Mouse detection
  /**
   * Converts an event's mouse coordinates to coordinates on the page.
   * @param {Event} evt The event to use.
   * @returns x, y coordinates relative to the top left of the page.
   */
  #getMousePosOnPage(evt) {
    const rect = this.#page.boundingClientRect;
    return {
      x: evt.clientX - rect.x,
      y: evt.clientY - rect.y,
    };
  }

  /**
   * Determines if the mouse is hovering over any part of the table, and returns the type/index of
   * the element being hovered.
   * @param {Dict} mousePos The position of the mouse relative to the top left corner of the page.
   * @returns The type (DragItem) and index of the component being hovered, or null if not being 
   * hovered.
   */
  #getIsHovering(mousePos) {
    // Check if hovering index column label
    if (this.#indexLabel.isWithinLabel(mousePos.x, mousePos.y)) {
      return [DragItem.INDEX, 0];
    }

    // Bottom right corner of table
    const brCorner =
      [this.#page.tableX + this.#page.tableWidth, this.#page.tableY + this.#page.tableHeight];

    if (
      !clampedBy(
        mousePos.x,this.#page.tableX - TABLE_HOVER_BUFFER, brCorner[0] + TABLE_HOVER_BUFFER) || 
      !clampedBy(
        mousePos.y, this.#page.tableY - TABLE_HOVER_BUFFER, brCorner[1] + TABLE_HOVER_BUFFER)
    ) {
      // Not within table bounds
      return null;
    }

    // Check if intercepting top or bottom row (horizontal) lines
    if (isNear(mousePos.y, this.#page.tableY, TABLE_HOVER_BUFFER)) {
      // Intercepting top row line
      return [DragItem.ROW, 0];
    } else if (isNear(mousePos.y, brCorner[1], TABLE_HOVER_BUFFER)) {
      // Intercepting bottom row line
      return [DragItem.ROW, this.#page.rowCount];
    }

    // Check if intercepting column (vertical) lines
    let cumWidth = 0;

    for (let c = 0; c <= this.#page.colCount; c++) {
      const x = this.#page.tableX + cumWidth;

      if (isNear(mousePos.x, x, TABLE_HOVER_BUFFER)) {
        // Intercepting this column line
        return [DragItem.COL, c];
      }

      // Accumulate column widths
      if (c !== this.#page.colCount) {
        cumWidth += this.#page.getColWidth(c);
      }
    }

    // Intercepting table but no lines
    return [DragItem.WHOLE, 0];
  }

  // MARK: Events
  /**
   * Handler for mouse move. Handles drag, hover logic.
   * @param {Event} evt Event.
   */
  #mouseMove(evt) {
    // Get mouse relative to page 
    const pos = this.#getMousePosOnPage(evt);

    if (this.#state === DragState.DRAGGING) {
      // We are actively being dragged
      const deltas = { x: pos.x - this.#lastMousePos.x, y: pos.y - this.#lastMousePos.y };

      switch (this.#activeItem) {
      case DragItem.COL: {
        // A column is being dragged left/right
        if (this.#activeIdx === 0) {
          // The first border is being dragged left, need to adjust the table's x position
          const clampedDeltaX =
              clamp(deltas.x, -this.#page.tableX, this.#page.getColWidth(0) - MIN_COL_SIZE);

          this.#page.setPosition(this.#page.tableX + clampedDeltaX, this.#page.tableY);
          this.#page.setColumnWidth(0, this.#page.getColWidth(0) - clampedDeltaX);
        } else {
          // Simply add to its width
          const idx = this.#activeIdx - 1;
          this.#page.setColumnWidth(idx, this.#page.getColWidth(idx) + deltas.x);
        }
        break;
      }
      case DragItem.ROW: {
        // A row is being dragged up/down
        if (this.#activeIdx === 0) {
          // The top border is being dragged up, need to adjust the table's y position
          this.#page.setPosition(this.#page.tableX, this.#page.tableY + deltas.y);
          this.#page.setTableHeight(this.#page.tableHeight - deltas.y);
        } else {
          // The bottom border is being dragged down
          this.#page.setTableHeight(this.#page.tableHeight + deltas.y);
        }
        break;
      }
      case DragItem.WHOLE: {
        // The whole table is being dragged
        this.#page.setPosition(this.#page.tableX + deltas.x, this.#page.tableY + deltas.y);
        break;
      }
      case DragItem.SELECTION_BOX: {
        // A selection box is being made
        // Determine the number of words intercepted
        const wordCount = this.#page.getWordsBoundedBy(this.#firstMousePos, pos);
        this.#bottomBarContent.innerText =
            `${wordCount} textbox${wordCount === 1 ? "" : "es"} selected`;
        this.#bottomBar.style.visibility = "visible";

        break;
      }
      case DragItem.INDEX: {
        // The index column is being moved
        this.#indexLabel.setDrag(deltas.x);
        break;
      }
      }

      this.#lastMousePos = pos;
      this.redraw();
    } else if (clampedBy(pos.x, 0, this.#page.width) && clampedBy(pos.y, 0, this.#page.height)) {
      // Check hovering?
      const hover = this.#getIsHovering(pos);

      if (hover === null) {
        // Nothing hovering
        this.#setStateAndLazyRedraw(DragState.NONE, DragItem.NONE, -1);
      } else {
        // Something is being hovered
        this.#setStateAndLazyRedraw(DragState.HOVER, hover[0], hover[1]);
      }
    }
  }

  /**
   * Handler for mouse down.
   * @param {Event} evt Event.
   */
  #mouseDown(evt) {
    this.#firstMousePos = this.#getMousePosOnPage(evt);
    this.#lastMousePos = this.#firstMousePos;

    if (this.#state === DragState.HOVER) {
      // Hovering, switch to dragging
      this.#setStateAndLazyRedraw(DragState.DRAGGING, this.#activeItem, this.#activeIdx);
    } else if (this.#state === DragState.NONE) {
      // Not hovering, switch to selection box
      this.#setStateAndLazyRedraw(DragState.DRAGGING, DragItem.SELECTION_BOX, 0);
    }
  }

  /**
   * Stops all dragging, lazily redrawing the table.
   */
  stopDragging() {
    this.#bottomBar.style.visibility = "hidden";
    this.#indexLabel.stopDragging();

    this.#setStateAndLazyRedraw(DragState.NONE, DragItem.NONE, -1);
  }

  // MARK: Redraw
  /**
   * Sets the state, redrawing only if the state has changed.
   * @param {DragState} newState The new state to use.
   * @param {DragItem} newItem The new drag item to use.
   * @param {int} newIdx The new drag index to use.
   */
  #setStateAndLazyRedraw(newState, newItem, newIdx) {
    const needsRedraw =
      (newState !== this.#state || newItem !== this.#activeItem || newIdx !== this.#activeIdx);

    this.#state = newState;
    this.#activeItem = newItem;
    this.#activeIdx = newIdx;

    if (needsRedraw) { this.redraw(); }
  }

  /**
   * Redraws the entire table.
   */
  redraw() {
    // Clear
    this.#ctx.reset();

    // Draw index label
    this.#indexLabel.redraw();

    // Draw horizontal (row) lines
    let cumHeight = 0;

    for (let r = 0; r <= this.#page.rowCount; r++) {
      let y = this.#page.tableY + cumHeight;
      y *= TABLE_SCALE_FACTOR;

      // Set stroke style
      const active = this.#state >= 0 && this.#activeItem === DragItem.ROW && this.#activeIdx === r;
      this.#ctx.lineWidth =
        (active ? ACTIVE_TABLE_BORDER_WIDTH : NORMAL_TABLE_BORDER_WIDTH) * TABLE_SCALE_FACTOR;
      this.#ctx.strokeStyle = active ? ACTIVE_TABLE_COLOR : NORMAL_TABLE_COLOR;

      // Draw line
      this.#ctx.beginPath();
      this.#ctx.moveTo(this.#page.tableX * TABLE_SCALE_FACTOR, y);
      this.#ctx.lineTo((this.#page.tableX + this.#page.tableWidth) * TABLE_SCALE_FACTOR, y);
      this.#ctx.stroke();

      // Accumulate the height
      if (r !== this.#page.rowCount) {
        cumHeight += this.#page.getRowHeight(r);
      }
    }

    // Draw vertical (column lines)
    let cumWidth = 0;

    for (let c = 0; c <= this.#page.colCount; c++) {
      let x = this.#page.tableX + cumWidth;
      x *= TABLE_SCALE_FACTOR;

      // Set stroke style
      const active = this.#state >= 0 && this.#activeItem === DragItem.COL && this.#activeIdx === c;
      this.#ctx.lineWidth =
        (active ? ACTIVE_TABLE_BORDER_WIDTH : NORMAL_TABLE_BORDER_WIDTH) * TABLE_SCALE_FACTOR;
      this.#ctx.strokeStyle = active ? ACTIVE_TABLE_COLOR : NORMAL_TABLE_COLOR;

      // Draw line
      this.#ctx.beginPath();
      this.#ctx.moveTo(x, this.#page.tableY * TABLE_SCALE_FACTOR);
      this.#ctx.lineTo(x, (this.#page.tableY + this.#page.tableHeight) * TABLE_SCALE_FACTOR);
      this.#ctx.stroke();

      // Accumulate the width across
      if (c !== this.#page.colCount) {
        cumWidth += this.#page.getColWidth(c);
      }
    }

    // Draw selection box
    if (this.#state === DragState.DRAGGING && this.#activeItem === DragItem.SELECTION_BOX) {
      this.#ctx.globalAlpha = 0.4;
      this.#ctx.fillStyle = "gray";
      this.#ctx.fillRect(
        this.#firstMousePos.x * TABLE_SCALE_FACTOR,
        this.#firstMousePos.y * TABLE_SCALE_FACTOR,
        (this.#lastMousePos.x - this.#firstMousePos.x) * TABLE_SCALE_FACTOR,
        (this.#lastMousePos.y - this.#firstMousePos.y) * TABLE_SCALE_FACTOR,
      );
      this.#ctx.globalAlpha = 1;
    }

    // Set pointer
    this.#page.setCursor(cursorForDragItem(this.#activeItem));
  }
}
