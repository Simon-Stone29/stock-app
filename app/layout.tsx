import type { Metadata } from "next";
import { AppNavbar } from "@/src/components/AppNavbar";
import "./globals.css";
import { FirstVisitRedirect } from "@/src/components/FirstVisitRedirect";

export const metadata: Metadata = {
  title: "AlphaPool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <FirstVisitRedirect />
        <AppNavbar />
        {children}
      </body> 
    </html>
  );
}