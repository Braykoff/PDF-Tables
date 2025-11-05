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

/**
 * In format:
 * {
 *    "width": 1,
 *    "height": 2,
 *    "canvas": DOMElement
 * }
 */
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
    const [canvas, w, h] = await renderPDFOntoCanvas(pdf, pageNum);

    // Keep track of each page
    maxWidth = Math.max(maxWidth, w);
    totalHeight += h + 10; // 10 px padding

    dom.canvasContainer.appendChild(canvas);

    pages.push({
      width: w,
      height: h,
      canvas: canvas
    });
  }

  // Overlay table container
  dom.tableContainer.style.width = `${maxWidth}px`;
  dom.tableContainer.style.height = `${Math.max(1, totalHeight - 10)}px`;

  console.log(`Loaded ${rawFile.name} with ${pages.length} pages`);
});

// On scroll, update page number
dom.canvasContainer.addEventListener("scroll", () => {
  let closestCanvas = null;
  let closestDist = Infinity;

  // Find closest canvas to viewport center
  for (const page of pages) {
    const rect = page.canvas.getBoundingClientRect();
    const dist = Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2);

    if (dist < closestDist) {
      closestDist = dist;
      closestCanvas = page.canvas;
    }
  }

  // Use closest page as current page
  if (closestCanvas) {
    currentPage = parseInt(closestCanvas.getAttribute("data-page"));
    dom.pageCounter.innerText = `Page ${currentPage}/${pages.length}`;
  }
});
