import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.min.mjs";

/** Source url for PDF.JS global worker. */
export const PDF_JS_GLOBAL_WORKER_SOURCE = "./dist/pdf.worker.min.mjs";

/**
 * Sets the PDF.JS global worker source.
 */
export function setGlobalWorkerSource() {
  GlobalWorkerOptions.workerSrc = PDF_JS_GLOBAL_WORKER_SOURCE;
  console.log(`Successfully set PDFJS global worker source to ${PDF_JS_GLOBAL_WORKER_SOURCE}`);
}

/**
 * Loads a pdf file into PDF.JS.
 * @param {File} file Input file object.
 * @returns PDF.JS PDFDocumentProxy object.
 */
export async function loadPDFFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  return await getDocument({ data: arrayBuffer }).promise;
}

/**
 * Renders a PDF.JS pdf onto a new canvas and returns its width and height.
 * @param {PDFDocumentProxy} pdf PDF object returned from PDF.JS.
 * @param {int} pageNum Page number (starting at 1).
 * @returns Created canvas, PDF page, PDF width, PDF height.
 */
export async function renderPDFOntoCanvas(pdf, pageNum) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return [canvas, page, viewport.width, viewport.height];
}

/**
 * Finds the center coordinates of a word and converts to a top-left relative coordinate frame.
 * @param {Dict} word A word returned by page.getTextContent().items.
 * @param {*} pageHeight The height of the page.
 * @returns The x, y coords of the word's center, relative to the top-left corner of the page.
 */
export function getTextCenter(word, pageHeight) {
  const [_a, _b, c, d, e, f] = word.transform;
  const height = Math.sqrt(c * c + d * d); // word.height is usually wrong

  return [
    e + (word.width / 2),
    pageHeight - (f + (height / 2)),
  ];
}
