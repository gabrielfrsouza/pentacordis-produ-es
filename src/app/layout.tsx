import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pentacordis OS",
  description: "Gestão operacional da produtora Pentacordis",
  icons: {
    icon: "/brand/fleur-de-lis.svg",
    apple: "/brand/fleur-de-lis.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${inter.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: 0,
              border: "1px solid #0A0A0A",
              background: "#FFFFFF",
              color: "#0A0A0A",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontSize: 11,
            },
          }}
        />
      </body>
    </html>
  );
}
