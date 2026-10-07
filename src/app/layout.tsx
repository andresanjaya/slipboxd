import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { AppShell } from "@/components/site-chrome";
import { LanguageProvider } from "@/i18n/provider";
import { DiaryProvider } from "@/lib/diary-provider";
import "./globals.css";
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";

export const metadata: Metadata = {
  title: "Slipboxd — Turn your Letterboxd diary into a receipt.",
  description: "Ubah diary Letterboxd menjadi struk film personal. Impor, sesuaikan, dan simpan sebagai PNG.",
  applicationName: "Slipboxd",
  appleWebApp: {
    capable: true,
    title: "Slipboxd",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><LanguageProvider><DiaryProvider><AppShell>{children}</AppShell></DiaryProvider></LanguageProvider><Analytics /></body></html>;
}
