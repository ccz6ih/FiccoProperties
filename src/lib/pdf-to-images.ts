/**
 * Convert a PDF File into one JPEG File per page, in the browser (canvas).
 * Done client-side so multi-page PDF receipts can embed as images in the
 * printable report. Caller should fall back to the original PDF on throw.
 */
export async function pdfToImages(file: File): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const base = file.name.replace(/\.pdf$/i, "") || "receipt";
  const out: File[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.85)
    );
    if (blob) out.push(new File([blob], `${base}-p${i}.jpg`, { type: "image/jpeg" }));
  }

  if (out.length === 0) throw new Error("No pages rendered");
  return out;
}
