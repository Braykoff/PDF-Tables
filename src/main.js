"use-strict";

import { setGlobalWorkerSource, loadPDFFromFile, } from "./pdf-wrapper.js";
import { DEFAULT_COL_SIZE, MAX_COLS, MAX_ROWS, PAGE_MARGIN } from "./constants.js";
import { Page } from "./page.js";
import { clamp } from "./utils.js";

/** Referenced HTML DOM elements. */
const dom = Object.freeze({
  fileInput: document.getElementById("fileInput"),
  fileTitle: document.getElementById("fileTitle"),
  pageCounter: document.getElementById("pageCount"),
  columnEntry: document.getElementById("columnEntry"),
  rowEntry: document.getElementById("rowEntry"),
  toggleTextBoxesButton: document.getElementById("showTextboxesAction"),
  applyAllButton: document.getElementById("applyToAllAction"),
  extractButton: document.getElementById("extractAction"),
  pageContainer: document.getElementById("pageContainer")
});

// Current app state
const state = {
  currentPage: -1,
  pages: [],
  textBoxesShown: false
};

// Prevent right click everywhere
document.body.addEventListener("contextmenu", (evt) => evt.preventDefault());

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
  dom.pageContainer.scrollTop = 0;
  dom.pageContainer.style.visibility = "hidden";

  for (const page of state.pages) {
    page.destroy();
  }

  state.pages = []

  // Load PDF
  let pdf = await loadPDFFromFile(rawFile);
  state.currentPage = 1;

  dom.pageCounter.innerText = `Page 1/${pdf.numPages}`;

  let maxWidth = 1;
  let totalHeight = 0;

  let colCount = parseInt(dom.columnEntry.value);
  let rowCount = parseInt(dom.rowEntry.value);

  const currentPageSupplier = () => state.currentPage;

  // Load each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    // Create page
    let page = await Page.create(dom.pageContainer, pdf, currentPageSupplier, pageNum, rowCount, colCount)
    state.pages.push(page);

    page.setTextboxesShown(state.textBoxesShown);

    // Keep track of cumulative size
    maxWidth = Math.max(maxWidth, page.width);
    totalHeight += page.height + PAGE_MARGIN;
  }

  // Now show PDF
  dom.pageContainer.style.visibility = "visible";

  const elapsed = (Date.now() - start) / 1000; // seconds
  console.log(`Loaded ${rawFile.name} with ${state.pages.length} pages in ${elapsed.toFixed(3)} seconds`);
});

// On scroll, update page number
dom.pageContainer.addEventListener("scroll", () => {
  let closestPage = null;
  let closestDist = Infinity;

  // Find closest canvas to viewport center
  for (const page of state.pages) {
    const dist = page.distToCenter;

    if (dist < closestDist) {
      closestDist = dist;
      closestPage = page;
    }
  }

  // Use closest page as current page
  if (closestPage) {
    state.currentPage = closestPage.index;
    dom.pageCounter.innerText = `Page ${state.currentPage}/${state.pages.length}`;

    // Update table dimension input
    dom.rowEntry.value = closestPage.rowCount;
    dom.columnEntry.value = closestPage.colCount;
  }
});

// When row input is changed, validate input and update table
dom.rowEntry.addEventListener("change", () => {
  const p = state.pages[state.currentPage - 1];
  const rows = clamp(dom.rowEntry.value, 1, MAX_ROWS);

  // TODO change
  dom.rowEntry.value = rows;
  p.rowCount = rows;

  // TODO rerender table here
});

// When column input is changed, validate input and update table
dom.columnEntry.addEventListener("change", () => {
  const p = state.pages[state.currentPage - 1];
  const cols = clamp(dom.columnEntry.value, 1, MAX_COLS);

  dom.columnEntry.value = cols;

  // TODO change
  if (cols < p.columnWidths.length) {
    // Remove columns
    p.columnWidths.length = cols;
  } else {
    // Add columns
    while (p.columnWidths.length !== cols) {
      p.columnWidths.push(DEFAULT_COL_SIZE);
    }
  }

  // TODO rerender table here
});

// Show/Hide Text boxes on toggle
dom.toggleTextBoxesButton.addEventListener("click", () => {
  state.textBoxesShown = !state.textBoxesShown;

  dom.toggleTextBoxesButton.innerText = (state.textBoxesShown ? "Hide" : "Show") + " Textboxes";

  for (const p of state.pages) {
    p.setTextboxesShown(state.textBoxesShown);
  }
});

// As soon as rendered, set PDF global worker source
setGlobalWorkerSource();
