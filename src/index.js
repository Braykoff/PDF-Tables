// Get HTML elements
const fileInputContainer = document.getElementById("fileInputContainer");
const fileInput = document.getElementById("fileInput");
const fileTitle = document.getElementById("fileTitle");
const pageCountElem = document.getElementById("pageCount");
const columnEntry = document.getElementById("columnEntry");
const rowEntry = document.getElementById("rowEntry");
const applyAllButton = document.getElementById("applyToAllAction");
const extractButton = document.getElementById("extractAction");

const canvasContainer = document.getElementById("canvasContainer");
const tableContainer = document.getElementById("tableContainer");
var pageCanvases = [];

// PDF File object
var pdfFile = undefined;
var pageCount = -1;
var currentPage = -1;

// File input changed, load new file
fileInput.addEventListener("change", async () => {
  // Load the library here
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://www.raykoff.org/PDF-Tables/pdfjs-5.4.394-legacy-dist/build/pdf.worker.mjs";

  // Check file is selected and no file has already been loaded
  if (fileInput.files.length != 0 || pdfFile != undefined) {
    pdfFile = fileInput.files[0]

    fileTitle.innerText = pdfFile.name;
    document.title = "PDFTables - " + pdfFile.name;

    // Don't allow file changing
    fileInput.setAttribute("disabled", "Y");
    fileInputContainer.classList.remove("action");

    // Load PDF
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    currentPage = 1;
    pageCount = pdf.numPages;
    pageCountElem.innerText = `Page 1/${pageCount}`

    maxWidth = 1
    totalHeight = 1

    // Load each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });

      maxWidth = Math.max(maxWidth, viewport.width);
      totalHeight += viewport.height + 10; // 10 px padding

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.setAttribute("data-page", pageNum);

      await page.render({ canvasContext: ctx, viewport }).promise;
      canvasContainer.appendChild(canvas);
      pageCanvases.push(canvas);
    }

    // Overlay table container
    tableContainer.style.width = `${maxWidth}px`;
    tableContainer.style.height = `${totalHeight}px`;
  }
});

// On scroll, update page number
canvasContainer.addEventListener("scroll", () => {
  let closestCanvas = null;
  let closestDist = Infinity;

  // Find closest canvas to viewport center
  for (const canvas of pageCanvases) {
    const rect = canvas.getBoundingClientRect();
    const dist = Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2);

    if (dist < closestDist) {
      closestDist = dist;
      closestCanvas = canvas;
    }
  }

  if (closestCanvas) {
    currentPage = closestCanvas.getAttribute("data-page");
    pageCountElem.innerText = `Page ${currentPage}/${pageCount}`;
  }
});
