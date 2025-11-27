// MARK: Definitions
import { PDFDocumentProxy } from "pdfjs-dist";
import { DEFAULT_COLS } from "./constants.js";
import { MessageBox } from "./message-box.js";
import { Page } from "./page.js";
import { loadPDFFromFile, setGlobalWorkerSource } from "./pdf-wrapper.js";
import { clamp, downloadFile, writeCSV } from "./utils.js";

/** Ratio between milliseconds and seconds. */
const MILLISECONDS_TO_SECONDS: number = 1000;

/** Amount to zoom per click, %. */
const ZOOM_RATE: number = 0.1;

/** Minimum zoom, %. */
const MIN_ZOOM: number = 0.5;

/** Max zoom, %. */
const MAX_ZOOM: number = 2.0;

// Referenced HTML DOM elements.
interface DomElements {
  fileInput: HTMLInputElement;
  fileTitle: HTMLLabelElement;
  pageCounter: HTMLSpanElement;
  columnEntry: HTMLInputElement;
  zoomOutAction: HTMLSpanElement;
  zoomInAction: HTMLSpanElement;
  toggleTextBoxesButton: HTMLSpanElement;
  applyAllButton: HTMLSpanElement;
  detectRowsButton: HTMLSpanElement;
  extractButton: HTMLSpanElement;
  pageContainer: HTMLDivElement;
  messageBoxContainer: HTMLDivElement;
  messageBoxContent: HTMLSpanElement;
}

const dom: Readonly<DomElements> = Object.freeze({
  fileInput: document.getElementById("fileInput") as HTMLInputElement,
  fileTitle: document.getElementById("fileTitle") as HTMLLabelElement,
  pageCounter: document.getElementById("pageCount") as HTMLSpanElement,
  columnEntry: document.getElementById("columnEntry") as HTMLInputElement,
  zoomOutAction: document.getElementById("zoomOutAction") as HTMLSpanElement,
  zoomInAction: document.getElementById("zoomInAction") as HTMLSpanElement,
  toggleTextBoxesButton: document.getElementById("showTextboxesAction") as HTMLSpanElement,
  applyAllButton: document.getElementById("applyToAllAction") as HTMLSpanElement,
  detectRowsButton: document.getElementById("detectRowsAction") as HTMLSpanElement,
  extractButton: document.getElementById("extractAction") as HTMLSpanElement,
  pageContainer: document.getElementById("pageContainer") as HTMLDivElement,
  messageBoxContainer: document.getElementById("messageBox") as HTMLDivElement,
  messageBoxContent: document.getElementById("messageBoxContent") as HTMLSpanElement,
});

// Current app state
interface AppState {
  currentPage: number;
  pages: Page[];
  zoom: number;
  textBoxesShown: boolean;
}

const state: AppState = {
  currentPage: -1,
  pages: [],
  zoom: 1.0,
  textBoxesShown: false,
};

// Message box
const messageBox: MessageBox = new MessageBox(dom.messageBoxContainer, dom.messageBoxContent);

// Prevent right click everywhere
document.body.addEventListener("contextmenu", (evt: MouseEvent) => evt.preventDefault());

// Warn before closing if document is open
window.addEventListener("beforeunload", (evt: BeforeUnloadEvent) => {
  if (state.currentPage !== -1) {
    evt.preventDefault();
    evt.returnValue = "";
  }
});

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

  // Reset zoom
  state.zoom = 1.0;

  // Load PDF
  const pdf: PDFDocumentProxy = await loadPDFFromFile(rawFile);
  state.currentPage = 1;

  dom.pageCounter.innerText = `Page 1/${pdf.numPages}`;
  dom.columnEntry.value = DEFAULT_COLS.toString();

  // Load each page
  for (let pageNum: number = 1; pageNum <= pdf.numPages; pageNum++) {
    // Create page
    const page: Page = await Page.create(dom.pageContainer, messageBox, pdf, pageNum);
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

// MARK: Key entry
document.addEventListener("keydown", (evt: KeyboardEvent) => {
  const ctrl: boolean = evt.metaKey || evt.ctrlKey || evt.shiftKey;

  // Check zoom
  if (ctrl && (evt.key === "+" || evt.key === "=")) {
    evt.preventDefault();
    setZoom(state.zoom + ZOOM_RATE);
  } else if (ctrl && (evt.key === "-" || evt.key === "_")) {
    evt.preventDefault();
    setZoom(state.zoom - ZOOM_RATE);
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
/**
 * Zooms the PDF in/out.
 * @param newZoom The new zoom, %.
 */
function setZoom(newZoom: number): void {
  state.zoom = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);

  for (const p of state.pages) {
    p.setZoom(state.zoom);
  }

  // Show the user the zoom
  messageBox.showTempText(`Zoom: ${Math.round(state.zoom * 100)}%`);
}

// Zoom out button
dom.zoomOutAction.addEventListener("click", () => { setZoom(state.zoom - ZOOM_RATE); });

// Zoom in button
dom.zoomInAction.addEventListener("click", () => { setZoom(state.zoom + ZOOM_RATE); });


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
