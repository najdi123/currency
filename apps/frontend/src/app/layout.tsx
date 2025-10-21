import type { Metadata } from "next";
import "./globals.css"; //
import StoreProvider from "@/lib/StoreProvider";
import { OfflineBannerWrapper } from "@/components/OfflineBannerWrapper";

export const metadata: Metadata = {
  title: "قیمت دقبق ارز و طلا",
  description: "دقیق ترین قیمت ارز، ارز دیجیتال و طلا",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <StoreProvider>
          <OfflineBannerWrapper />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
