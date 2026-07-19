import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const proximaNova = localFont({
  src: [
    {
      path: "../external/fonts/ProximaNovaRegular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../external/fonts/ProximaNovaBold.woff",
      weight: "700",
      style: "normal",
    },
    {
      path: "../external/fonts/ProximaNovaBlack.woff",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-proxima-nova",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Todolist",
  description: "A simple todo list app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${proximaNova.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
