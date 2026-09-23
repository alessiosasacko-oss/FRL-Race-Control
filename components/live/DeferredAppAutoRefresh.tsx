"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const AppAutoRefresh = dynamic(() => import("./AppAutoRefresh"), {
  ssr: false,
});

export default function DeferredAppAutoRefresh() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const windowWithIdle = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (windowWithIdle.requestIdleCallback) {
      const handle = windowWithIdle.requestIdleCallback(
        () => setReady(true),
        { timeout: 2_000 },
      );
      return () => windowWithIdle.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(() => setReady(true), 1_500);
    return () => window.clearTimeout(handle);
  }, []);

  return ready ? <AppAutoRefresh /> : null;
}
