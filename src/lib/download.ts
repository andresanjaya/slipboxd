// Rasterize the exact visible SVG, with self-contained fonts/colors/layout.
export async function receiptPng(svg: SVGSVGElement): Promise<Blob> {
  await document.fonts.ready;
  const width = svg.viewBox.baseVal.width;
  const height = svg.viewBox.baseVal.height;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const source = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Gambar belum berhasil dibuat."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * 3;
    canvas.height = height * 3;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas tidak tersedia.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG gagal dibuat.")), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

export function savePng(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
