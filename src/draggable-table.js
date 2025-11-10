import { ACTIVE_TABLE_BORDER_COLOR, ACTIVE_TABLE_BORDER_WIDTH, NORMAL_TABLE_BORDER_COLOR, NORMAL_TABLE_BORDER_WIDTH, TABLE_HOVER_BUFFER, TABLE_SCALE_FACTOR } from "./constants.js";
import { within } from "./utils.js";

/** Describes what is being dragged currently. */
const DragDim = {
  NONE: -1, // No active drag dimension
  COL: 0, // Dragging a column border (vertical line)
  ROW: 1, // Dragging a row border (horizontal line)
  WHOLE: 2 // Dragging whole table
}

/** Describe the state  */
const DragState = {
  NONE: -1, // Nothing active
  HOVER: 0, // Being hovered
  DRAGGING: 1 // Actively dragging
}

/**
 * Determines the cursor depending on the drag dimension.
 * @param {DragDim} dim The drag dimension.
 * @returns The CSS cursor.
 */
function cursorForDragDim(dim) {
  switch (dim) {
    case DragDim.COL:
      return "col-resize";
    case DragDim.ROW:
      return "row-resize";
    case DragDim.WHOLE:
      return "move";
    default:
      return "";
  }
}

/**
 * Represents a page's table that can dragged around.
 */
export class DraggableTable {
  #page = undefined;
  #ctx = undefined;
  #activeDim = DragDim.NONE;
  #activeIdx = -1; // index of the object being dragged
  #state = DragState.NONE;
  #dragStart = undefined; // Coordinate of mouse at beginning of drag, relative to page.

  /**
   * Creates a DraggableTable object.
   * @param {Page} page The page object for this table.
   */
  constructor(page) {
    this.#page = page;

    // Create our canvas
    const canvas = document.createElement("canvas");
    canvas.width = page.width * TABLE_SCALE_FACTOR;
    canvas.height = page.height * TABLE_SCALE_FACTOR;
    canvas.classList.add("tableCanvas");
    page.addCanvas(canvas);

    this.#ctx = canvas.getContext("2d");

    // Initial draw
    this.stopDragging();
    this.redraw();

    // Init listeners
    const mouseMoveListener = this.#mouseMove.bind(this);
    const mouseDownListener = this.#mouseDown.bind(this);
    const mouseUpListener = this.stopDragging.bind(this);

    document.addEventListener("mousemove", mouseMoveListener);
    document.addEventListener("mousedown", mouseDownListener);
    document.addEventListener("mouseup", mouseUpListener);

    // Create function to remove event listeners
    this.detach = function () {
      document.removeEventListener("mousemove", mouseMoveListener);
      document.removeEventListener("mousedown", mouseDownListener);
      document.removeEventListener("mouseup", mouseUpListener);
    }
  }

  /**
   * Sets the state, redrawing only if the state has changed.
   * @param {DragState} newState The new state to use.
   * @param {DragDim} newDim The new drag dimension to use.
   * @param {int} newIdx The new drag index to use.
   */
  #setStateAndLazyRedraw(newState, newDim, newIdx) {
    const needsRedraw = newState !== this.#state || newDim !== this.#activeDim || newIdx !== this.#activeIdx;

    this.#state = newState;
    this.#activeDim = newDim;
    this.#activeIdx = newIdx;

    if (needsRedraw) { this.redraw(); }
  }

  /**
   * Converts an event's mouse coordinates to coordinates on the page.
   * @param {Event} evt The event to use.
   * @returns x, y coordinates relative to the top left of the page.
   */
  #getMousePosOnPage(evt) {
    const rect = this.#page.boundingClientRect;
    return {
      x: evt.clientX - rect.x,
      y: evt.clientY - rect.y
    };
  }

  /**
   * Determines if the mouse is hovering over any part of the table, and returns the type/index of
   * the element being hovered.
   * @param {Dict} mousePos The position of the mouse relative to the top left corner of the page.
   * @returns The type (DragDim) and index of the component being hovered, or null if not being hovered.
   */
  #getIsHovering(mousePos) {
    // Bottom right corner of table
    const brCorner = [this.#page.tableX + this.#page.tableWidth, this.#page.tableY + this.#page.tableHeight];

    if (mousePos.x < this.#page.tableX - TABLE_HOVER_BUFFER || mousePos.y < this.#page.tableY - TABLE_HOVER_BUFFER) {
      // Too far left/too high, not in table
      return null;
    } else if (mousePos.x > brCorner[0] + TABLE_HOVER_BUFFER || mousePos.y > brCorner[1] + TABLE_HOVER_BUFFER) {
      // Too far right/too high, not in table
      return null;
    }

    // Check if intercepting top or bottom row (horizontal) lines
    if (within(mousePos.y, this.#page.tableY, TABLE_HOVER_BUFFER)) {
      // Intercepting top row line
      return [DragDim.ROW, 0];
    } else if (within(mousePos.y, brCorner[1], TABLE_HOVER_BUFFER)) {
      // Intercepting bottom row line
      return [DragDim.ROW, this.#page.rowCount];
    }

    // Check if intercepting column (vertical) lines
    let cumWidth = 0;

    for (let c = 0; c <= this.#page.colCount; c++) {
      const x = this.#page.tableX + cumWidth;

      if (within(mousePos.x, x, TABLE_HOVER_BUFFER)) {
        // Intercepting this column line
        return [DragDim.COL, c];
      }

      // Accumulate column widths
      if (c !== this.#page.colCount) {
        cumWidth += this.#page.getColWidth(c);
      }
    }

    // Intercepting table but no lines
    return [DragDim.WHOLE, 0];
  }

  /**
   * Handler for mouse move. Handles drag, hover logic.
   * @param {Event} evt Event.
   */
  #mouseMove(evt) {
    if (this.#page.pagesFromViewport > 1) {
      // Too far away, don't even check anything
      this.stopDragging();
    } else {
      // Get mouse relative to page 
      const pos = this.#getMousePosOnPage(evt);

      if (this.#state === DragState.DRAGGING) {
        // We are actively being dragged
        // TODO validate position
        if (this.#activeDim === DragDim.COL) {
          // A column is being dragged left/right
        } else if (this.#activeDim === DragDim.ROW) {
          // A row is being dragged up/down
        } else {
          // The whole table is being dragged
        }
      } else {
        // Check hovering?
        const hover = this.#getIsHovering(pos);

        if (hover === null) {
          // Nothing hovering
          this.#setStateAndLazyRedraw(DragState.NONE, DragDim.NONE, -1);
        } else {
          // Something is being hovered
          this.#setStateAndLazyRedraw(DragState.HOVER, hover[0], hover[1]);
        }
      }
    }
  }

  /**
   * Handler for mouse down.
   * @param {Event} evt Event.
   */
  #mouseDown(evt) {
    if (this.#state === DragState.HOVER) {
      // Hovering, switch to dragging
      this.#dragStart = this.#getMousePosOnPage(evt);
      this.#setStateAndLazyRedraw(DragState.DRAGGING, this.#activeDim, this.#activeIdx);
    }
  }

  /**
   * Stops all dragging, lazily redrawing the table.
   */
  stopDragging() {
    this.#setStateAndLazyRedraw(DragState.NONE, DragDim.NONE, -1);
  }

  /**
   * Redraws the entire table.
   */
  redraw() {
    // Clear
    this.#ctx.reset();

    // Draw horizontal (row) lines
    for (let r = 0; r <= this.#page.rowCount; r++) {
      let y = this.#page.tableY + (this.#page.rowHeight * r);
      y *= TABLE_SCALE_FACTOR;

      // Set stroke style
      const active = this.#state >= 0 && this.#activeDim == DragDim.ROW && this.#activeIdx == r;
      this.#ctx.lineWidth = (active ? ACTIVE_TABLE_BORDER_WIDTH : NORMAL_TABLE_BORDER_WIDTH) * TABLE_SCALE_FACTOR;
      this.#ctx.strokeStyle = active ? ACTIVE_TABLE_BORDER_COLOR : NORMAL_TABLE_BORDER_COLOR;

      // Draw line
      this.#ctx.beginPath();
      this.#ctx.moveTo(this.#page.tableX * TABLE_SCALE_FACTOR, y);
      this.#ctx.lineTo((this.#page.tableX + this.#page.tableWidth) * TABLE_SCALE_FACTOR, y);
      this.#ctx.stroke();
    }

    // Draw vertical (column lines)
    let cumWidth = 0;

    for (let c = 0; c <= this.#page.colCount; c++) {
      let x = this.#page.tableX + cumWidth;
      x *= TABLE_SCALE_FACTOR;

      // Set stroke style
      const active = this.#state >= 0 && this.#activeDim == DragDim.COL && this.#activeIdx == c;
      this.#ctx.lineWidth = (active ? ACTIVE_TABLE_BORDER_WIDTH : NORMAL_TABLE_BORDER_WIDTH) * TABLE_SCALE_FACTOR;
      this.#ctx.strokeStyle = active ? ACTIVE_TABLE_BORDER_COLOR : NORMAL_TABLE_BORDER_COLOR;

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

    // Set pointer
    this.#page.setCursor(cursorForDragDim(this.#activeDim));
  }
}
