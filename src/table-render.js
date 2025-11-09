// Table style constants
const tableStyle = {
  scaleFactor: 2, // Resolution of table lines
  defaultBorderWidth: 1.5,
  defaultBorderColor: "navy",
  activeBorderWidth: 4,
  activeBorderColor: "blue",
  buffer: 2 // amount cursor can be off to still be considered "hovering" (px)
}

const DragDim = {
  NONE: -1, // No active drag dimension
  COL: 0, // Dragging a column border (vertical line)
  ROW: 1, // Dragging a row border (horizontal line)
  WHOLE: 2 // Dragging whole table
}

const DragState = {
  NONE: -1, // Nothing active
  HOVER: 0, // Being hovered
  DRAGGING: 1 // Actively dragging
}

function cursorForDragDim(dim) {
  if (dim === DragDim.COL) return "resize-col";
  else if (dim === DragDim.ROW) return "resize-row";
  else if (dim === DragDim.WHOLE) return "resize";
  else return "";
}

class DraggableTable {
  #page = undefined;
  #ctx = undefined;
  #activeDim = DragDim.NONE;
  #activeIdx = -1; // index of the object being dragged
  #state = DragState.NONE;

  constructor(page) {
    this.#page = page;

    // Create our canvas
    const [canvas, ctx] = createCanvas(page.width, page.height, tableStyle.scaleFactor);
    canvas.classList.add("tableCanvas");
    page.canvasContainer.appendChild(canvas);

    this.#ctx = ctx;

    // Initial draw
    this.#stopDragging(false);
    this.redraw();

    // Init listeners
    const mouseMoveListener = this.#mouseMove.bind(this);
    const mouseDownListener = this.#mouseDown.bind(this);
    const mouseUpListener = this.#stopDragging.bind(this);

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

  #getMousePosOnPage(evt) {
    const rect = this.#page.canvasContainer.getBoundingClientRect();
    return {
      x: evt.clientX - rect.x,
      y: evt.clientY - rect.y,
      //xScaled: (evt.clientX - rect.x) * tableStyle.scaleFactor,
      //yScaled: (evt.clientY - rect.y) * tableStyle.scaleFactor,
    };
  }

  #getIsHovering(mousePos) {
    // Bottom right corner of table
    const brCorner = [this.#page.tableCoords[0] + this.#page.tableWidth, this.#page.tableCoords[1] + (this.#page.rowCount * this.#page.rowHeight)];

    if (mousePos.x < this.#page.tableCoords[0] - tableStyle.buffer || mousePos.y < this.#page.tableCoords[1] - tableStyle.buffer) {
      // Too far left/too high, not in table
      return null;
    } else if (mousePos.x > brCorner[0] + tableStyle.buffer || mousePos.y > brCorner[1] + tableStyle.buffer) {
      // Too far right/too high, not in table
      return null;
    }

    // Check if intercepting top or bottom row (horizontal) lines
    if (Math.abs(mousePos.y - this.#page.tableCoords[1]) <= tableStyle.buffer) {
      // Intercepting top row line
      return [DragDim.ROW, 0];
    } else if (Math.abs(mousePos.y - brCorner[1]) <= tableStyle.buffer) {
      // Intercepting bottom row line
      return [DragDim.ROW, this.#page.rowCount];
    }

    // Check if intercepting column (vertical) lines
    let cumWidth = 0;

    for (let c = 0; c <= this.#page.columnWidths.length; c++) {
      const x = this.#page.tableCoords[0] + cumWidth;

      if (Math.abs(mousePos.x - x) <= tableStyle.buffer) {
        // Intercepting this column line
        return [DragDim.COL, c];
      }

      // Accumulate column widths
      if (c !== this.#page.columnWidths.length) {
        cumWidth += this.#page.columnWidths[c];
      }
    }

    // Intercepting table but no lines
    return [DragDim.WHOLE, 0];
  }

  #mouseMove(evt) {
    if (Math.abs(this.#page.idx - state.currentPage) > 1) {
      // Too far away, don't even check anything
      this.#stopDragging();
      return;
    } else {
      // Get mouse relative to page 
      const pos = this.#getMousePosOnPage(evt);

      if (this.#state === DragState.DRAGGING) {
        // We are actively being dragged

      } else {
        // Check hovering?
        const hover = this.#getIsHovering(pos);

        if (hover === null) {
          // Nothing hovering
          this.#state = DragState.NONE;
        } else {
          // Something is being hovered
          this.#state = DragState.HOVER;
          this.#activeDim = hover[0];
          this.#activeIdx = hover[1];
        }

        this.#page.canvasContainer.style.cursor = cursorForDragDim(this.#state);
      }

      this.redraw();
    }
  }

  #mouseDown(evt) {

  }

  #stopDragging(checkRedraw = true) {
    let needsRedraw = (checkRedraw && this.#state !== DragState.NONE);

    this.#state = DragState.NONE;
    this.#page.canvasContainer.style.cursor = "";

    // If our state changed, we may need to redraw
    if (needsRedraw) {
      this.redraw(false);
    }
  }

  redraw(stopDragging = false) {
    if (stopDragging) {
      // Stop dragging everything
      this.#stopDragging(false); // Don't check redraw, already redrawing!
    }

    // Clear
    this.#ctx.reset();

    // Draw horizontal (row) lines
    for (let r = 0; r <= this.#page.rowCount; r++) {
      let y = this.#page.tableCoords[1] + (this.#page.rowHeight * r);
      y *= tableStyle.scaleFactor;

      // Set stroke style
      const active = this.#state >= 0 && this.#activeDim == DragDim.ROW && this.#activeIdx == r;
      this.#ctx.lineWidth = active ? tableStyle.activeBorderWidth : tableStyle.defaultBorderWidth;
      this.#ctx.strokeStyle = active ? tableStyle.activeBorderColor : tableStyle.defaultBorderColor;

      this.#ctx.beginPath();
      this.#ctx.moveTo(this.#page.tableCoords[0] * tableStyle.scaleFactor, y);
      this.#ctx.lineTo((this.#page.tableCoords[0] + this.#page.tableWidth) * tableStyle.scaleFactor, y);
      this.#ctx.stroke();
    }

    // Draw vertical (column lines)
    let cumWidth = 0;

    for (let c = 0; c <= this.#page.columnWidths.length; c++) {
      let x = this.#page.tableCoords[0] + cumWidth;
      x *= tableStyle.scaleFactor;

      // Set stroke style
      const active = this.#state >= 0 && this.#activeDim == DragDim.COL && this.#activeIdx == c;
      this.#ctx.lineWidth = active ? tableStyle.activeBorderWidth : tableStyle.defaultBorderWidth;
      this.#ctx.strokeStyle = active ? tableStyle.activeBorderColor : tableStyle.defaultBorderColor;

      this.#ctx.beginPath();
      this.#ctx.moveTo(x, this.#page.tableCoords[1] * tableStyle.scaleFactor);
      this.#ctx.lineTo(x, (this.#page.tableCoords[1] + (this.#page.rowHeight * this.#page.rowCount)) * tableStyle.scaleFactor);
      this.#ctx.stroke();

      // Accumulate the width across
      if (c !== this.#page.columnWidths.length) {
        cumWidth += this.#page.columnWidths[c];
      }
    }
  }
}
