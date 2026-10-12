"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Last-resort error boundary. Renders its own html/body, so it avoids next-intl and the UI kit. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, display: "grid", placeItems: "center", minHeight: "100vh", padding: 24, textAlign: "center" }}>
        <main>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 4px" }} dir="rtl" lang="ar">حدث خطأ ما. يرجى المحاولة مرة أخرى.</p>
          <p style={{ margin: "0 0 16px" }} lang="tr">Bir şeyler ters gitti. Lütfen tekrar deneyin.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #888", background: "transparent", cursor: "pointer", fontSize: 14 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
