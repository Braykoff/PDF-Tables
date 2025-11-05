// HTML elements
const dom = {
  fileInput: document.getElementById("fileInput"),
  fileTitle: document.getElementById("fileTitle"),
  pageCounter: document.getElementById("pageCount"),
  columnEntry: document.getElementById("columnEntry"),
  rowEntry: document.getElementById("rowEntry"),
  applyAllButton: document.getElementById("applyToAllAction"),
  extractButton: document.getElementById("extractAction"),
  canvasContainer: document.getElementById("canvasContainer"),
  tableContainer: document.getElementById("tableContainer")
};

// PDF File object
var pdf = undefined;
var currentPage = -1;

// Contains idx, width, height, canvas, distToTop, columnWidth, rowCount, rowHeight, tableCoords
var pages = []

// File input changed, load new file
dom.fileInput.addEventListener("change", async () => {
  if (dom.fileInput.files.length == 0) {
    // No file selected
    console.warn("Aborting because no files selected");
    return;
  }

  const rawFile = dom.fileInput.files[0]

  // Display file name
  dom.fileTitle.innerText = rawFile.name;
  dom.fileTitle.title = rawFile.name;
  document.title = "PDFTables - " + rawFile.name;

  // Reset canvas container
  dom.canvasContainer.style.display = "block";
  dom.canvasContainer.scrollTop = 0;

  for (const page of pages) {
    page.canvas.remove();
  }

  while (dom.tableContainer.firstChild) {
    dom.tableContainer.firstChild.remove();
  }

  pages = []

  // Load PDF
  pdf = await loadPDFFromFile(rawFile);

  currentPage = 1;
  dom.pageCounter.innerText = `Page 1/${pdf.numPages}`;

  maxWidth = 1;
  totalHeight = 0;

  // Load each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const [canvas, width, height] = await renderPDFOntoCanvas(pdf, pageNum);

    // Keep track of each page
    maxWidth = Math.max(maxWidth, width);
    totalHeight += height + 10; // 10 px padding

    dom.canvasContainer.appendChild(canvas);

    // Max number of cols = width, rows = height because min width/height is 1px
    let colCount = Math.min(parseInt(dom.columnEntry.value), width);
    let rowCount = Math.min(parseInt(dom.rowEntry.value), height);

    pages.push({
      idx: pdf.numPages, // Page index
      width: width, // Width of page (px)
      height: height, // Height of page (px)
      canvas: canvas, // Canvas element
      distToTop: totalHeight, // Distance to top of tableContainer (px)
      columnWidths: Array(colCount).fill(MutationObserver.min(35, Math.floor(width/colCount))), // Width of each column (px)
      rowCount: rowCount, // Number of rows
      rowHeight: Math.min(20, Math.floor(height/rowCount)), // All rows are the same height (px)
      tableCoords: [0, 0] // x, y coords of table from top left corner (px)
    });

    // TODO rerender table here
  }

  // Overlay table container
  dom.tableContainer.style.width = `${maxWidth}px`;
  dom.tableContainer.style.height = `${Math.max(1, totalHeight - 10)}px`;

  // Set row and column input to default value (in case it changed because of size limitations)
  dom.rowEntry.value = pages[0].rowCount;
  dom.columnEntry.value = pages[0].columnWidths.length;

  console.log(`Loaded ${rawFile.name} with ${pages.length} pages`);
});

// On scroll, update page number
dom.canvasContainer.addEventListener("scroll", () => {
  let closestPage = null;
  let closestDist = Infinity;

  // Find closest canvas to viewport center
  for (const page of pages) {
    const rect = page.canvas.getBoundingClientRect();
    const dist = Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2);

    if (dist < closestDist) {
      closestDist = dist;
      closestPage = page;
    }
  }

  // Use closest page as current page
  if (closestPage) {
    currentPage = closestPage.idx;
    dom.pageCounter.innerText = `Page ${currentPage}/${pages.length}`;

    // Update table dimension input
    dom.rowEntry.value = closestPage.rowCount;
    dom.columnEntry.value = closestPage.columnWidths.length;
  }
});

// When row input is changed, validate input and update table
dom.rowEntry.addEventListener("change", () => {
  const p = pages[currentPage];
  const rows = Math.max(Math.min(dom.rowEntry.value, p.height), 1);

  dom.rowEntry.value = rows;
  p.rowCount = rows;

  // TODO rerender table here
})

// When column input is changed, validate input and update table
dom.columnEntry.addEventListener("change", () => {
  const p = pages[currentPage];
  const cols = Math.max(Math.min(dom.columnEntry.value, p.width), 1);

  dom.columnEntry.value = rows;

  if (cols < p.columnWidths.length) {
    // Remove columns
    p.columnWidths.length = cols;
  } else {
    // Add columns
    while (p.columnWidths.length !== cols) {
      p.columnWidths.push(35);
    }
  }

  // TODO rerender table here
})
