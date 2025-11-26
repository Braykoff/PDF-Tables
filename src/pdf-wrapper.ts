import {
  getDocument, GlobalWorkerOptions, PageViewport,
  PDFDocumentProxy, PDFPageProxy,
} from "pdfjs-dist";
import { TextItem } from "pdfjs-dist/types/src/display/api";
import { get2dCanvasContext, Pos } from "./utils";

/** A type representing a word on the page. */
export type Word = {
  /** The position of the center of the word. */
  pos: Pos;
  content: string;
};

/** Source url for PDF.JS global worker. */
export const PDF_JS_GLOBAL_WORKER_SOURCE: string = "./dist/pdf.worker.min.mjs";

/**
 * Sets the PDF.JS global worker source.
 */
export function setGlobalWorkerSource(): void {
  GlobalWorkerOptions.workerSrc = PDF_JS_GLOBAL_WORKER_SOURCE;
  console.log(`Successfully set PDFJS global worker source to ${PDF_JS_GLOBAL_WORKER_SOURCE}`);
}

/**
 * Loads a pdf file into PDF.JS.
 * @param file Input file object.
 * @returns Promise for PDF.JS PDFDocumentProxy object.
 */
export async function loadPDFFromFile(file: File): Promise<PDFDocumentProxy> {
  const arrayBuffer: ArrayBuffer = await file.arrayBuffer();
  return getDocument({ data: arrayBuffer }).promise;
}

/**
 * Renders a PDF.JS pdf onto a new canvas and returns its width and height.
 * @param pdf PDF object returned from PDF.JS.
 * @param pageNum Page number (starting at 1).
 * @returns Created canvas, PDF page, PDF width, PDF height.
 */
export async function renderPDFOntoCanvas(
  pdf: PDFDocumentProxy,
  pageNum: number,
): Promise<[HTMLCanvasElement, PDFPageProxy, number, number]> {
  const page: PDFPageProxy = await pdf.getPage(pageNum);
  const viewport: PageViewport = page.getViewport({ scale: 1 });

  const canvas: HTMLCanvasElement = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render(
    { canvas: canvas, canvasContext: get2dCanvasContext(canvas), viewport }).promise;
  return [canvas, page, viewport.width, viewport.height];
}

/**
 * Converts a TextItem from pdfjs into a Word, such that the pos is from the center of the word to
 * the top-left of the page.
 * @param word A word returned by page.getTextContent().items.
 * @param pageHeight The height of the page.
 * @returns The word as a Word object.
 */
export function getWord(word: TextItem, pageHeight: number): Word {
  const [, , c = 0, d = 0, e = 0, f = 0]: (number | undefined)[] = word.transform;
  const height: number = Math.sqrt(c * c + d * d); // word.height is usually wrong

  return {
    pos: {
      x: e + (word.width / 2),
      y: pageHeight - (f + (height / 2)),
    },
    content: word.str,
  };
}
