import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChromaSand",
  description: "Color-clear tetromino game where cleared blocks pour into sand.",
  applicationName: "ChromaSand",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    title: "ChromaSand",
    description: "A color-clearing tetromino puzzle where cleared rows pour into sand.",
    type: "website",
  },
};

export const viewport: Viewport = {
  // viewport-fit=cover required for env(safe-area-inset-*) to report real values
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  // prevent pinch-zoom / double-tap-zoom messing with touch controls
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
