function dragHorizontal() {

}

function dragVertical() {

}

function dragTable() {

}

class DraggableTable {
  constructor() {

  } 
}

function renderTableForPage(pageNum) {
  const page = state.pages[pageNum-1];
  let table = dom.tableContainer.querySelector(`[data-page="${pageNum}"]`);

  if (table === undefined) {
    // This table has yet to be drawn
    table = document.createElement("div");
    table.classList.add("table");
    table.setAttribute("data-page", pageNum);
    dom.tableContainer.appendChild(table);

    table.addEventListener("mousedown", dragTable.bind(null, table));

    // Add row borders
    for (let r = 0; r <= page.rowCount; r++) {
      // Create horizontal line
      let line = document.createElement("div");
      line.classList.add("horizontalLine");
      line.setAttribute("data-row", r);
      table.appendChild(line);
      
      if (r === 0 || r === page.rowCount) {
        // Only allow moving on bottom rows
        line.style.cursor = "row-resize";
        line.addEventListener("mousedown", dragHorizontal.bind(null, line));
      }
    }

    // Add column borders
    for (let c = 0; c <= page.columnWidths.length; c++) {
      // Create vertical line
      let line = document.createElement("div");
      line.classList.add("verticalLine");
      line.setAttribute("data-col", c);
      table.appendChild(line);

      line.addEventListener("mousedown", dragVertical.bind(null, line));
    }

    dom.tableContainer.appendChild(elem);
  }

  // Set position, etc
}