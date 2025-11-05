/**
 * Tries to set the PDF.JS global worker source every 100ms until success.
 */
function setGlobalWorkerSource() {
  if (window.hasOwnProperty("pdfjsLib")) {
    // PDFJS has been loaded
    pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdfjs-5.4.394-legacy-dist/build/pdf.worker.mjs";
    console.log("Successfully set PDFJS global worker source");
  } else {
    // PDFJS not yet loaded
    window.setTimeout(setGlobalWorkerSource, 100);
  }
}

/**
 * Loads a pdf file into PDF.JS.
 * @param {File} file Input file object.
 * @returns PDF.JS PDFDocumentProxy object.
 */
async function loadPDFFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  return await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

/**
 * Renders a PDF.JS pdf onto a new canvas and returns its width and height.
 * @param {PDFDocumentProxy} pdf PDF object returned from PDF.JS.
 * @param {int} pageNum Page number (starting at 1).
 * @param {float} scale Viewport scaling (default 1.0).
 * @returns Created canvas, PDF width, PDF height.
 */
async function renderPDFOntoCanvas(pdf, pageNum, scale=1.0) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.setAttribute("data-page", pageNum);

  await page.render({ canvasContext: ctx, viewport }).promise;
  return [canvas, viewport.width, viewport.height];
}

// As soon as loaded, try setting the global worker source
setGlobalWorkerSource();
