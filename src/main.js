"use-strict";

// MARK: Definitions
import { DEFAULT_COLS } from "./constants.js";
import { Page } from "./page.js";
import { loadPDFFromFile, setGlobalWorkerSource } from "./pdf-wrapper.js";
import { downloadFile, writeCSV } from "./utils.js";

/** Ratio between milliseconds and seconds. */
const MILLISECONDS_TO_SECONDS = 1000;

// Referenced HTML DOM elements.
const dom = Object.freeze({
  fileInput: document.getElementById("fileInput"),
  fileTitle: document.getElementById("fileTitle"),
  pageCounter: document.getElementById("pageCount"),
  columnEntry: document.getElementById("columnEntry"),
  toggleTextBoxesButton: document.getElementById("showTextboxesAction"),
  applyAllButton: document.getElementById("applyToAllAction"),
  detectRowsButton: document.getElementById("detectRowsAction"),
  extractButton: document.getElementById("extractAction"),
  pageContainer: document.getElementById("pageContainer"),
  bottomBar: document.getElementById("bottomBar"),
  bottomBarContent: document.getElementById("bottomBarContent"),
});

// Current app state
const state = {
  currentPage: -1,
  pages: [],
  textBoxesShown: false,
};

// Prevent right click everywhere
document.body.addEventListener("contextmenu", (evt) => evt.preventDefault());

// MARK: File input
// File input changed, load new file
dom.fileInput.addEventListener("change", async () => {
  if (dom.fileInput.files.length === 0) {
    // No file selected
    console.warn("Aborting because no files selected");
    return;
  }

  const start = Date.now();
  const rawFile = dom.fileInput.files[0];

  // Display file name
  dom.fileTitle.innerText = rawFile.name;
  dom.fileTitle.title = rawFile.name;
  document.title = `PDFTables - ${  rawFile.name}`;

  // Reset canvas container
  dom.pageContainer.scrollTop = 0;
  dom.pageContainer.style.visibility = "hidden";

  for (const page of state.pages) {
    page.destroy();
  }

  state.pages = [];

  // Load PDF
  const pdf = await loadPDFFromFile(rawFile);
  state.currentPage = 1;

  dom.pageCounter.innerText = `Page 1/${pdf.numPages}`;
  dom.columnEntry.value = DEFAULT_COLS;

  // Load each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    // Create page
    const page = await Page.create(dom, pdf, pageNum);
    state.pages.push(page);

    page.setTextboxesShown(state.textBoxesShown);
  }

  // Now show PDF
  dom.pageContainer.style.visibility = "visible";

  const elapsed = (Date.now() - start) / MILLISECONDS_TO_SECONDS; // seconds
  console.log(`Loaded ${rawFile.name} with ${state.pages.length} pages in ${elapsed.toFixed(2)} seconds`);
});

// MARK: Scroll handler
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
    dom.columnEntry.value = closestPage.colCount;
  }
});

// MARK: Column entry
// When column input is changed, validate input and update table
dom.columnEntry.addEventListener("change", () => {
  const page = state.pages[state.currentPage - 1];
  if (page === undefined) {return;}

  const clampedCols = page.setColumnCount(dom.columnEntry.value);
  page.forceRedraw();
  dom.columnEntry.value = clampedCols;
});

// MARK: Action handlers
// Show/Hide Text boxes on toggle
dom.toggleTextBoxesButton.addEventListener("click", () => {
  state.textBoxesShown = !state.textBoxesShown;

  dom.toggleTextBoxesButton.innerText = `${state.textBoxesShown ? "Hide" : "Show"  } Textboxes`;

  for (const p of state.pages) {
    p.setTextboxesShown(state.textBoxesShown);
  }
});

// Apply to all following pages button
dom.applyAllButton.addEventListener("click", () => {
  const template = state.pages[state.currentPage - 1];
  if (template === undefined) {return;}

  for (let p = state.currentPage; p < state.pages.length; p++) {
    state.pages[p].copyFrom(template);
  }
});

// When detect rows button pressed, detect rows
dom.detectRowsButton.addEventListener("click", () => {
  for (const p of state.pages) {
    p.detectRows();
  }
});

// Extract data to csv
dom.extractButton.addEventListener("click", () => {
  dom.extractButton.innerText = "Extracting...";

  const csv = writeCSV(state.pages);
  downloadFile("output.csv", csv);

  dom.extractButton.innerText = "Extract";
});

// As soon as rendered, set PDF global worker source
setGlobalWorkerSource();
