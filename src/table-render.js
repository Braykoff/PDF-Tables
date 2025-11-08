// Table style constants
const tableStyle = {
  scaleFactor: 2, // Resolution of table lines
  defaultBorderWidth: 1,
  defaultBorderColor: "navy"
}

class DraggableTable {
  #page = undefined;
  #ctx = undefined;
  #rightPadding = 0;
  #draggingDim = -1; // 0 = column border (vertical line), 1 = row border (horizontal line), 2 = whole table 
  #draggingIdx = -1; // index of the object being dragged

  constructor(page, canvasCtx, canvasWidth) {
    this.#page = page;
    this.#ctx = canvasCtx;
    this.#rightPadding = (canvasWidth - page.width) / 2;

    this.#stopDragging();
    this.redraw(false);

    document.addEventListener("mousemove", this.#mouseMove.bind(this));
    document.addEventListener("mousedown", this.#mouseDown.bind(this));
    document.addEventListener("mouseup", this.#stopDragging.bind(this));
  }

  #clearRect() {
    this.#ctx.clearRect(this.#rightPadding, this.#page.distToTop, this.#page.width, this.#page.height);
  }

  #mouseMove(evt) {
    if (this.#draggingDim !== -1) {
      // We are currently being dragged
    } else if (Math.abs(state.currentPage - this.#page.idx) <= 1) {
      // Only check hover if we are somewhere on the page

    }
  }

  #mouseDown(evt) {

  }

  #stopDragging() {
    this.#draggingDim = -1;
    this.#draggingIdx = -1;
    document.body.style.cursor = "";
  }

  redraw(stopDragging) {
    if (stopDragging) {
      // Stop dragging everything
      this.#stopDragging();
    }

    // Clear our rect
    this.#clearRect();

    // Draw horizontal (row) lines
    for (let r = 0; r <= this.#page.rowCount; r++) {
      let y = this.#page.distToTop + this.#page.tableCoords[1] + (this.#page.rowHeight * r);
      y *= tableStyle.scaleFactor;

      // Set stroke style
      this.#ctx.lineWidth = tableStyle.defaultBorderWidth;
      this.#ctx.strokeStyle = tableStyle.defaultBorderColor;

      this.#ctx.beginPath();
      this.#ctx.moveTo((this.#rightPadding + this.#page.tableCoords[0]) * tableStyle.scaleFactor, y);
      this.#ctx.lineTo((this.#rightPadding + this.#page.tableCoords[0] + this.#page.tableWidth) * tableStyle.scaleFactor, y);
      this.#ctx.stroke();
    }

    // Draw vertical (column lines)
    let cumWidth = 0;

    for (let c = 0; c <= this.#page.columnWidths.length; c++) {
      let x = this.#rightPadding + this.#page.tableCoords[0] + cumWidth;
      x *= tableStyle.scaleFactor;

      // Set stroke style
      this.#ctx.lineWidth = tableStyle.defaultBorderWidth;
      this.#ctx.strokeStyle = tableStyle.defaultBorderColor;

      this.#ctx.beginPath();
      this.#ctx.moveTo(x, (this.#page.distToTop + this.#page.tableCoords[1]) * tableStyle.scaleFactor);
      this.#ctx.lineTo(x, (this.#page.distToTop + this.#page.tableCoords[1] + (this.#page.rowHeight * this.#page.rowCount)) * tableStyle.scaleFactor);
      this.#ctx.stroke();

      // Accumulate the width across
      if (c !== this.#page.columnWidths.length) {
        cumWidth += this.#page.columnWidths[c];
      }
    }
  }
}
