"use client";

import { useEffect, useRef } from "react";
import { dispatchAppDataChanged, type AppDataScope } from "@/lib/live/data-events";

export default function LiveMutationSignal({
  scopes,
  clearQueryParameter,
}: {
  scopes: AppDataScope[];
  clearQueryParameter?: string;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    dispatchAppDataChanged(scopes);
    if (clearQueryParameter) {
      const url = new URL(window.location.href);
      url.searchParams.delete(clearQueryParameter);
      window.history.replaceState(window.history.state, "", url);
    }
  }, [clearQueryParameter, scopes]);

  return null;
}
