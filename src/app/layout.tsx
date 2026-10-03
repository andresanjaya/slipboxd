import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slipboxd — Your films. Your receipt.",
  description: "Ubah diary Letterboxd menjadi struk film personal. Impor, sesuaikan, dan simpan sebagai PNG.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
