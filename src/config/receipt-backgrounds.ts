export const RECEIPT_BACKGROUNDS = {
  "paper-bg-1": "/assets/paper-bg-1.jpg",
  "paper-bg-2": "/assets/paper-bg-2.jpeg",
  "paper-bg-3": "/assets/paper-bg-3.jpeg",
  "paper-bg-4": "/assets/paper-bg-4.jpg",
} as const;

export type ReceiptBackgroundId = keyof typeof RECEIPT_BACKGROUNDS;

// Change only this value to update both the receipt preview and exported PNG.
export const DEFAULT_RECEIPT_BACKGROUND: ReceiptBackgroundId = "paper-bg-2";

export const ACTIVE_RECEIPT_BACKGROUND = RECEIPT_BACKGROUNDS[DEFAULT_RECEIPT_BACKGROUND];
