import { DEFAULT_COLS, PAGE_MARGIN } from "./constants.js";
import { loadPDFFromFile, setGlobalWorkerSource } from "./pdf-wrapper.js";
import { downloadFile, writeCSV } from "./utils.js";

/**
 * Runs all the base functionality for both modes. This includes:
 * - Prevents right click
 * - Document input changes
 * - Page number update on scroll
 * - Column input changed
 * - Show/hide text boxes
 * - Apply to all following pages
 * - Extract to CSV
 * - Set global worker source
 * @param {typeof BasePage} PageClass The subclass of BasePage to use for new pages.
 * @param {*} state A reference to the current state (containing pages and currentPage fields).
 * @param {*} onPageChange Callback that is run whenever the user scrolls to a new page and takes
 * the page as a argument.
 */
export function runBaseApp(PageClass, state, onPageChange) {
  // Referenced HTML DOM elements.
  const dom = Object.freeze({
    fileInput: document.getElementById("fileInput"),
    fileTitle: document.getElementById("fileTitle"),
    pageCounter: document.getElementById("pageCount"),
    columnEntry: document.getElementById("columnEntry"),
    toggleTextBoxesButton: document.getElementById("showTextboxesAction"),
    applyAllButton: document.getElementById("applyToAllAction"),
    extractButton: document.getElementById("extractAction"),
    pageContainer: document.getElementById("pageContainer")
  });

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
    dom.columnEntry.value = DEFAULT_COLS;

    let maxWidth = 1;
    let totalHeight = 0;

    const currentPageSupplier = () => state.currentPage;

    // Load each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      // Create page
      let page = await PageClass.create(dom.pageContainer, pdf, currentPageSupplier, pageNum);
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
      dom.columnEntry.value = closestPage.colCount;

      onPageChange(closestPage);
    }
  });

  // When column input is changed, validate input and update table
  dom.columnEntry.addEventListener("change", () => {
    const page = state.pages[state.currentPage - 1];
    if (page === undefined) return;

    const clampedCols = page.setColumnCount(dom.columnEntry.value);
    dom.columnEntry.value = clampedCols;
  });

  // Show/Hide Text boxes on toggle
  dom.toggleTextBoxesButton.addEventListener("click", () => {
    state.textBoxesShown = !state.textBoxesShown;

    dom.toggleTextBoxesButton.innerText = (state.textBoxesShown ? "Hide" : "Show") + " Textboxes";

    for (const p of state.pages) {
      p.setTextboxesShown(state.textBoxesShown);
    }
  });

  // Apply to all following pages button
  dom.applyAllButton.addEventListener("click", () => {
    const template = state.pages[state.currentPage - 1];
    if (template === undefined) return;

    for (let p = state.currentPage; p < state.pages.length; p++) {
      state.pages[p].copyFrom(template);
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
}