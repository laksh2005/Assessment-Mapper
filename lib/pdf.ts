"use client";

import type { PageImage } from "./types";

/**
 * Render scale for PDF pages. 2x of CSS-pixel size keeps handwriting legible
 * enough for the model to transcribe while staying under request size limits.
 */
const PDF_RENDER_SCALE = 2;

/** Cap on the long edge for uploaded images, to bound request size. */
const MAX_IMAGE_EDGE = 2000;

type Pdfjs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<Pdfjs> | null = null;

async function loadPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

/**
 * Encode as JPEG, not PNG.
 *
 * Vercel caps a serverless request body at 4.5 MB and every page is posted
 * inline as base64. PNG of a scanned page runs to several MB on its own, which
 * blows that budget at three or four pages; JPEG at this quality is roughly an
 * order of magnitude smaller and costs nothing in OCR accuracy at this
 * resolution.
 */
function encode(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Rough decoded byte size of a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  return Math.floor(((dataUrl.length - comma - 1) * 3) / 4);
}

async function renderPdf(
  file: File,
  onPage?: (done: number, total: number) => void,
): Promise<PageImage[]> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: PageImage[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get a 2D canvas context.");

    // White backdrop: PDFs render transparent, and transparent-on-black
    // destroys OCR accuracy.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    pages.push({
      pageIndex: i - 1,
      dataUrl: encode(canvas),
      width: canvas.width,
      height: canvas.height,
    });
    onPage?.(i, doc.numPages);
  }

  await doc.destroy();
  return pages;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read image: ${file.name}`));
    };
    img.src = url;
  });
}

async function renderImage(file: File, pageIndex: number): Promise<PageImage> {
  const img = await loadImageElement(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return {
    pageIndex,
    dataUrl: encode(canvas),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Normalize a set of uploaded files (PDFs and/or images) into an ordered list
 * of page images.
 *
 * Everything is rasterized here, in the browser, before upload. The bitmap the
 * model reasons about is byte-identical to the one rendered on screen, so the
 * bounding boxes it returns need no coordinate conversion to line up with what
 * the teacher sees.
 */
export async function filesToPageImages(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<PageImage[]> {
  const pages: PageImage[] = [];

  for (const file of files) {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const rendered = await renderPdf(file, onProgress);
      for (const page of rendered) {
        pages.push({ ...page, pageIndex: pages.length });
      }
    } else if (file.type.startsWith("image/")) {
      pages.push(await renderImage(file, pages.length));
      onProgress?.(pages.length, pages.length);
    } else {
      throw new Error(`Unsupported file type: ${file.name}`);
    }
  }

  if (pages.length === 0) throw new Error("No readable pages were found.");
  return pages;
}

export async function countPages(files: File[]): Promise<number> {
  let total = 0;
  for (const file of files) {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const pdfjs = await loadPdfjs();
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      total += doc.numPages;
      await doc.destroy();
    } else {
      total += 1;
    }
  }
  return total;
}
