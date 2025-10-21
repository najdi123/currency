import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import StoreProvider from "@/lib/StoreProvider";
import { OfflineBannerWrapper } from "@/components/OfflineBannerWrapper";

// Professional Persian font - Vazirmatn Variable Font
// Optimized for Persian/Farsi text with excellent readability
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-vazirmatn",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "دقیق‌ترین قیمت ارز و طلا",
  description: "دقیق‌ترین قیمت ارز، ارز دیجیتال و طلا",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className={vazirmatn.className}>
        <StoreProvider>
          <OfflineBannerWrapper />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
