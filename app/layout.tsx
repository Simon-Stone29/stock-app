// src/app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stock App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}