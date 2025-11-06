"use-strict";

// HTML elements
const dom = {
  fileInput: document.getElementById("fileInput"),
  fileTitle: document.getElementById("fileTitle"),
  pageCounter: document.getElementById("pageCount"),
  columnEntry: document.getElementById("columnEntry"),
  rowEntry: document.getElementById("rowEntry"),
  toggleTextBoxesButton: document.getElementById("showTextboxesAction"),
  applyAllButton: document.getElementById("applyToAllAction"),
  extractButton: document.getElementById("extractAction"),
  canvasContainer: document.getElementById("canvasContainer"),
  wordCanvas: document.getElementById("wordCanvas"),
  tableContainer: document.getElementById("tableContainer")
};

// Constants
const constants = {
  pageMargin: 10, // Margin between pages, px
  maxRows: 200, // Max number of rows
  maxCols: 50, // Max numbers of columns
  defaultRowSize: 20, // Default row size, px
  defaultColSize: 35 // Default column size, px
}

// Current app state
const state = {
  currentPage: -1,
  pages: [],
  textBoxesShown: false
};

// File input changed, load new file
dom.fileInput.addEventListener("change", async () => {
  if (dom.fileInput.files.length === 0) {
    // No file selected
    console.warn("Aborting because no files selected");
    return;
  }

  const start = Date.now();
  const rawFile = dom.fileInput.files[0]

  // Display file name
  dom.fileTitle.innerText = rawFile.name;
  dom.fileTitle.title = rawFile.name;
  document.title = "PDFTables - " + rawFile.name;

  // Reset canvas container
  dom.canvasContainer.scrollTop = 0;
  dom.canvasContainer.style.display = "none";

  for (const page of state.pages) {
    page.canvas.remove();
  }

  while (dom.tableContainer.firstChild) {
    dom.tableContainer.firstChild.remove();
  }

  state.pages = []

  // Load PDF
  let pdf = await loadPDFFromFile(rawFile);
  state.currentPage = 1;

  dom.pageCounter.innerText = `Page 1/${pdf.numPages}`;

  let maxWidth = 1;
  let totalHeight = 0;

  // Load each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    // Draw page
    const [canvas, page, width, height] = await renderPDFOntoCanvas(pdf, pageNum);
    canvas.classList.add("page");
    dom.canvasContainer.appendChild(canvas);

    // Get words on page
    const textContent = (await page.getTextContent()).items;
    let words = [];

    for (const word of textContent) {
      // Check not blank
      if (!isStringEmpty(word.str)) {
        // Pos relative to top left corner
        const pos = getTextCenter(word, height)

        words.push({
          content: word.str,
          x: pos[0],
          y: pos[1]
        });
      }
    }

    // Use current row/column dimensions
    let colCount = parseInt(dom.columnEntry.value);
    let rowCount = parseInt(dom.rowEntry.value);

    state.pages.push({
      idx: pageNum, // Page index
      width: width, // Width of page (px)
      height: height, // Height of page (px)
      canvas: canvas, // Canvas element
      distToTop: totalHeight, // Distance to top of tableContainer (px)
      columnWidths: Array(colCount).fill(constants.defaultColSize), // Width of each column (px)
      rowCount: rowCount, // Number of rows
      rowHeight: constants.defaultRowSize, // All rows are the same height (px)
      tableCoords: [0, 0], // x, y coords of table from top left corner (px)
      words: words, // List of words and x, y coords
      dragHandler: null // DraggableTable object
    });

    // Keep track of each page position
    maxWidth = Math.max(maxWidth, width);
    totalHeight += height + constants.pageMargin;
  }

  // Now show PDF
  dom.canvasContainer.style.display = "block";

  // Overlay table container
  dom.tableContainer.style.width = `${maxWidth}px`;
  dom.tableContainer.style.height = `${Math.max(1, totalHeight - constants.pageMargin)}px`;

  // TODO rerender tables

  // Overlay word canvas
  dom.wordCanvas.style.width = `${maxWidth}px`;
  dom.wordCanvas.style.height = `${Math.max(1, totalHeight - constants.pageMargin)}px`;

  dom.wordCanvas.width = maxWidth;
  dom.wordCanvas.height = Math.max(1, totalHeight - constants.pageMargin);

  // Set row and column input to default value (in case it changed because of size limitations)
  dom.rowEntry.value = state.pages[0].rowCount;
  dom.columnEntry.value = state.pages[0].columnWidths.length;

  // Now that the word canvas size is known, draw words
  const wordCtx = dom.wordCanvas.getContext("2d");
  wordCtx.reset();
  wordCtx.fillStyle = "red";

  for (const p of state.pages) {
    for (const w of p.words) {
      wordCtx.beginPath();
      wordCtx.arc(w.x + maxWidth - p.width, p.distToTop + w.y, 2, 0, 2 * Math.PI);
      wordCtx.fill();
    }
  }

  const elapsed = (Date.now() - start) / 1000; // seconds
  console.log(`Loaded ${rawFile.name} with ${state.pages.length} pages in ${elapsed.toFixed(3)} seconds`);
});

// On scroll, update page number
dom.canvasContainer.addEventListener("scroll", () => {
  let closestPage = null;
  let closestDist = Infinity;

  // Find closest canvas to viewport center
  for (const page of state.pages) {
    const rect = page.canvas.getBoundingClientRect();
    const dist = Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2);

    if (dist < closestDist) {
      closestDist = dist;
      closestPage = page;
    }
  }

  // Use closest page as current page
  if (closestPage) {
    state.currentPage = closestPage.idx;
    dom.pageCounter.innerText = `Page ${state.currentPage}/${state.pages.length}`;

    // Update table dimension input
    dom.rowEntry.value = closestPage.rowCount;
    dom.columnEntry.value = closestPage.columnWidths.length;
  }
});

// When row input is changed, validate input and update table
dom.rowEntry.addEventListener("change", () => {
  const p = state.pages[state.currentPage-1];
  const rows = clamp(dom.rowEntry.value, 1, constants.maxRows);

  dom.rowEntry.value = rows;
  p.rowCount = rows;

  // TODO rerender table here
});

// When column input is changed, validate input and update table
dom.columnEntry.addEventListener("change", () => {
  const p = state.pages[state.currentPage-1];
  const cols = clamp(dom.columnEntry.value, 1, constants.maxCols);

  dom.columnEntry.value = cols;

  if (cols < p.columnWidths.length) {
    // Remove columns
    p.columnWidths.length = cols;
  } else {
    // Add columns
    while (p.columnWidths.length !== cols) {
      p.columnWidths.push(constants.defaultColSize);
    }
  }

  // TODO rerender table here
});

// Show/Hide Text boxes on toggle
dom.toggleTextBoxesButton.addEventListener("click", () => {
  state.textBoxesShown = !state.textBoxesShown;

  dom.wordCanvas.style.display = state.textBoxesShown ? "block" : "none";
  dom.toggleTextBoxesButton.innerText = (state.textBoxesShown ? "Hide" : "Show") + " Textboxes";
});
