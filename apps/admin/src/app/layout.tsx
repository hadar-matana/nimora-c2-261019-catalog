import type { Metadata } from "next";
import { headers } from "next/headers";
import { MockProvider } from "@/components/MockProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { ApiProofProvider } from "@/components/ApiProofProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATELIER | ניהול החנות — הדגמה מקומית",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.ADMIN_LOCAL_PROOF !== "0")
    return (
      <html lang="he" dir="rtl">
        <body>
          <ToastProvider>
            <ApiProofProvider>{children}</ApiProofProvider>
          </ToastProvider>
        </body>
      </html>
    );
  const host = (await headers()).get("host") ?? "";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
  const enabled =
    process.env.NODE_ENV === "development" ||
    process.env.ADMIN_LOCAL_PREVIEW === "1";
  return (
    <html lang="he" dir="rtl">
      <body>
        {local && enabled ? (
          <ToastProvider>
            <MockProvider>{children}</MockProvider>
          </ToastProvider>
        ) : (
          <main className="disabled-demo">
            <h1>הדגמה מקומית בלבד</h1>
            <p>ממשק זה אינו זמין לפריסה ציבורית.</p>
          </main>
        )}
      </body>
    </html>
  );
}
