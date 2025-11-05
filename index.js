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
var pageCanvases = [];

// PDF File object
var pdfFile = undefined;
var pageCount = -1;
var currentPage = -1;

// File input changed, load new file
fileInput.addEventListener("change", async () => {
  // Load the library here
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://www.raykoff.org/pdf-tables/pdfjs-5.4.394-legacy-dist/build/pdf.worker.mjs";

  // Check file is selected
  if (fileInput.files.length != 0) {
    pdfFile = fileInput.files[0]

    fileTitle.innerText = pdfFile.name;
    document.title = "PDFTables - " + pdfFile.name;

    // Don't allow file changing
    fileInput.setAttribute("disabled", "Y");
    fileInputContainer.classList.remove("action");

    // Reset container
    canvasContainer.style.display = "block";
    pageCanvases = [];
    canvasContainer.innerHTML = "";

    // Load PDF
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    currentPage = 1;
    pageCount = pdf.numPages;
    pageCountElem.innerText = `Page 1/${pageCount}`

    // Load each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.setAttribute("data-page", pageNum);

      await page.render({ canvasContext: ctx, viewport }).promise;
      canvasContainer.appendChild(canvas);
      pageCanvases.push(canvas);
    }
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
