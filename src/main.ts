// MARK: Definitions
import { PDFDocumentProxy } from "pdfjs-dist";
import { DEFAULT_COLS } from "./constants.js";
import { Page } from "./page.js";
import { loadPDFFromFile, setGlobalWorkerSource } from "./pdf-wrapper.js";
import { downloadFile, writeCSV } from "./utils.js";

/** Ratio between milliseconds and seconds. */
const MILLISECONDS_TO_SECONDS: number = 1000;

// Referenced HTML DOM elements.
interface DomElements {
  fileInput: HTMLInputElement;
  fileTitle: HTMLLabelElement;
  pageCounter: HTMLSpanElement;
  columnEntry: HTMLInputElement;
  toggleTextBoxesButton: HTMLSpanElement;
  applyAllButton: HTMLSpanElement;
  detectRowsButton: HTMLSpanElement;
  extractButton: HTMLSpanElement;
  pageContainer: HTMLDivElement;
  bottomBar: HTMLDivElement;
  bottomBarContent: HTMLSpanElement;
}

const dom: Readonly<DomElements> = Object.freeze({
  fileInput: document.getElementById("fileInput") as HTMLInputElement,
  fileTitle: document.getElementById("fileTitle") as HTMLLabelElement,
  pageCounter: document.getElementById("pageCount") as HTMLSpanElement,
  columnEntry: document.getElementById("columnEntry") as HTMLInputElement,
  toggleTextBoxesButton: document.getElementById("showTextboxesAction") as HTMLSpanElement,
  applyAllButton: document.getElementById("applyToAllAction") as HTMLSpanElement,
  detectRowsButton: document.getElementById("detectRowsAction") as HTMLSpanElement,
  extractButton: document.getElementById("extractAction") as HTMLSpanElement,
  pageContainer: document.getElementById("pageContainer") as HTMLDivElement,
  bottomBar: document.getElementById("bottomBar") as HTMLDivElement,
  bottomBarContent: document.getElementById("bottomBarContent") as HTMLSpanElement,
});

// Current app state
interface AppState {
  currentPage: number;
  pages: Page[];
  textBoxesShown: boolean;
}

const state: AppState = {
  currentPage: -1,
  pages: [],
  textBoxesShown: false,
};

// Prevent right click everywhere
document.body.addEventListener("contextmenu", (evt: MouseEvent) => evt.preventDefault());

// MARK: File input
// File input changed, load new file
dom.fileInput.addEventListener("change", async () => {
  if (dom.fileInput.files!.length === 0) {
    // No file selected
    console.warn("Aborting because no files selected");
    return;
  }

  const start: number = Date.now();
  const rawFile: File = dom.fileInput.files![0]!;

  // Display file name
  dom.fileTitle.innerText = rawFile.name;
  dom.fileTitle.title = rawFile.name;
  document.title = `PDFTables - ${rawFile.name}`;

  // Reset canvas container
  dom.pageContainer.scrollTop = 0;
  dom.pageContainer.style.visibility = "hidden";

  for (const page of state.pages) {
    page.destroy();
  }

  state.pages = [];

  // Load PDF
  const pdf: PDFDocumentProxy = await loadPDFFromFile(rawFile);
  state.currentPage = 1;

  dom.pageCounter.innerText = `Page 1/${pdf.numPages}`;
  dom.columnEntry.value = DEFAULT_COLS.toString();

  // Load each page
  for (let pageNum: number = 1; pageNum <= pdf.numPages; pageNum++) {
    // Create page
    const page: Page = await Page.create(dom, pdf, pageNum);
    state.pages.push(page);

    page.setTextboxesShown(state.textBoxesShown);
  }

  // Now show PDF
  dom.pageContainer.style.visibility = "visible";

  const elapsed: number = (Date.now() - start) / MILLISECONDS_TO_SECONDS; // seconds
  console.log(
    `Loaded ${rawFile.name} with ${state.pages.length} pages in ${elapsed.toFixed(2)} seconds`);
});

// MARK: Scroll handler
// On scroll, update page number
dom.pageContainer.addEventListener("scroll", () => {
  let closestPage: Page | null = null;
  let closestDist: number = Infinity;

  // Find closest canvas to viewport center
  for (const page of state.pages) {
    const dist: number = page.distToCenter;

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
    dom.columnEntry.value = closestPage.colCount.toString();
  }
});

// MARK: Column entry
// When column input is changed, validate input and update table
dom.columnEntry.addEventListener("change", () => {
  const page: Page = state.pages[state.currentPage - 1]!;
  if (page === undefined) { return; }

  const clampedCols: number = page.setColumnCount(parseInt(dom.columnEntry.value));
  page.forceRedraw();
  dom.columnEntry.value = clampedCols.toString();
});

// MARK: Action handlers
// Show/Hide Text boxes on toggle
dom.toggleTextBoxesButton.addEventListener("click", () => {
  state.textBoxesShown = !state.textBoxesShown;

  dom.toggleTextBoxesButton.innerText = `${state.textBoxesShown ? "Hide" : "Show"} Textboxes`;

  for (const p of state.pages) {
    p.setTextboxesShown(state.textBoxesShown);
  }
});

// Apply to all following pages button
dom.applyAllButton.addEventListener("click", () => {
  const template: Page = state.pages[state.currentPage - 1]!;
  if (template === undefined) { return; }

  for (let p: number = state.currentPage; p < state.pages.length; p++) {
    state.pages[p]!.copyFrom(template);
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

  const csv: string = writeCSV(state.pages);
  downloadFile("output.csv", csv);

  dom.extractButton.innerText = "Extract";
});

// As soon as rendered, set PDF global worker source
setGlobalWorkerSource();
