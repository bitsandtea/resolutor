import type { Metadata } from "next";
// Import fonts from next/font/google
import "@rainbow-me/rainbowkit/styles.css";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";

import { Providers } from "../lib/providers";

// Configure Inter for sans-serif
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter", // CSS variable for Inter
  display: "swap",
});

// Configure Roboto Mono for monospace
const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono", // CSS variable for Roboto Mono
  display: "swap",
});

export const metadata: Metadata = {
  title: "Resolutor",
  description: "Resolve disputes on the blockchain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        // Apply the font variables to the body
        className={`${inter.variable} ${robotoMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
