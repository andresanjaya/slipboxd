import { ACTIVE_RECEIPT_BACKGROUND } from "@/config/receipt-backgrounds";

export const RECEIPT_FONT_FAMILY = "Merchant Copy";
export const RECEIPT_FONT_URL = "/fonts/merchant-copy.ttf";
export const RECEIPT_IMAGE_URLS = ["/assets/figma-letterboxd-logo.svg", "/assets/figma-barcode.svg"] as const;

const assetData = new Map<string, Promise<string>>();

function loadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Receipt asset failed to load: ${url}`));
    image.src = url;
  });
}

async function asDataUrl(url: string): Promise<string> {
  let pending = assetData.get(url);
  if (!pending) {
    pending = fetch(url).then(response => {
      if (!response.ok) throw new Error(`Receipt asset failed to load: ${url}`);
      return response.blob();
    }).then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error(`Receipt asset could not be embedded: ${url}`));
      reader.onerror = () => reject(new Error(`Receipt asset could not be embedded: ${url}`));
      reader.readAsDataURL(blob);
    }));
    assetData.set(url, pending);
  }
  return pending;
}

export async function prepareReceiptAssets(backgroundUrl: string = ACTIVE_RECEIPT_BACKGROUND): Promise<void> {
  await Promise.all([
    document.fonts.load(`16px "${RECEIPT_FONT_FAMILY}"`),
    loadImage(backgroundUrl),
    ...RECEIPT_IMAGE_URLS.map(loadImage),
  ]);
  await document.fonts.ready;
  if (!document.fonts.check(`16px "${RECEIPT_FONT_FAMILY}"`)) throw new Error("Merchant Copy failed to load.");
}

// Rasterize the exact visible SVG, embedding its local font and paper texture.
export async function receiptPng(svg: SVGSVGElement): Promise<Blob> {
  const background = svg.querySelector<SVGImageElement>("image[data-receipt-background]");
  const backgroundUrl = background?.getAttribute("href") ?? ACTIVE_RECEIPT_BACKGROUND;
  await prepareReceiptAssets(backgroundUrl);
  const width = svg.viewBox.baseVal.width;
  const height = svg.viewBox.baseVal.height;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const images = [...clone.querySelectorAll<SVGImageElement>("image[data-receipt-asset]")];
  const [fontDataUrl, ...imageDataUrls] = await Promise.all([asDataUrl(RECEIPT_FONT_URL), ...images.map(node => asDataUrl(node.getAttribute("href") ?? ""))]);
  images.forEach((node, index) => node.setAttribute("href", imageDataUrls[index]));
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `@font-face{font-family:'${RECEIPT_FONT_FAMILY}';src:url('${fontDataUrl}') format('truetype');font-style:normal;font-weight:400;font-display:block}@font-face{font-family:'${RECEIPT_FONT_FAMILY}';src:url('${fontDataUrl}') format('truetype');font-style:normal;font-weight:700;font-display:block}`;
  clone.prepend(style);
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
