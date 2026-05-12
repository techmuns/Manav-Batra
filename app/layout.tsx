import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financial Risk Dashboard",
  description:
    "Beneish M-Score and Altman Z-Score for Indian listed companies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
