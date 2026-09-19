import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans, DM_Mono } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Sanemi OS — Centre de commandement",
  description: "Dashboard personnel de Lord Sanemi — Hexjen Conceptions",
  appleWebApp: {
    title: "Sanemi OS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff6a00",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${syne.variable} ${dmSans.variable} ${dmMono.variable} h-full`}
    >
      <body className="min-h-full bg-black text-ink font-sans antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
