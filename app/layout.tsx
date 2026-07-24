import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sfPro = localFont({
  src: "../external/sf_pro/SFPRODISPLAYREGULAR.ttf",
  variable: "--font-sf-pro",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Todolist",
  description: "A simple todo list app",
};

const APP_FONT_INIT_SCRIPT = `(function(){try{var f=localStorage.getItem("todolist-app-font");if(f==="sf-pro")document.documentElement.dataset.appFont="sf-pro";}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-app-font="inter"
      className={`${inter.variable} ${sfPro.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: APP_FONT_INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
