"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  PWA_INSTALL_AVAILABLE_EVENT,
  PWA_INSTALLED_EVENT,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa/client";

export default function PwaLifecycle() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const refreshRequested = useRef(false);

  useEffect(() => {
    const installAvailable = (event: Event) => {
      event.preventDefault();
      window.__frlInstallPrompt = event as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event(PWA_INSTALL_AVAILABLE_EVENT));
    };
    const installed = () => {
      delete window.__frlInstallPrompt;
      window.dispatchEvent(new Event(PWA_INSTALLED_EVENT));
    };
    window.addEventListener("beforeinstallprompt", installAvailable);
    window.addEventListener("appinstalled", installed);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("beforeinstallprompt", installAvailable);
        window.removeEventListener("appinstalled", installed);
      };
    }

    let registration: ServiceWorkerRegistration | null = null;
    let updateInterval: number | null = null;
    let reloading = false;
    const controllerChanged = () => {
      if (!refreshRequested.current || reloading) return;
      reloading = true;
      window.location.reload();
    };
    const checkWaitingWorker = () => {
      if (registration?.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
      }
    };
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") {
        void registration?.update();
      }
    };

    if (process.env.NODE_ENV === "production") {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((nextRegistration) => {
          registration = nextRegistration;
          checkWaitingWorker();
          registration.addEventListener("updatefound", () => {
            const installing = registration?.installing;
            installing?.addEventListener("statechange", () => {
              if (installing.state === "installed") checkWaitingWorker();
            });
          });
          updateInterval = window.setInterval(checkForUpdate, 60 * 60 * 1_000);
          document.addEventListener("visibilitychange", checkForUpdate);
        })
        .catch(() => {
          // The web application remains fully usable without service workers.
        });
      navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    }

    return () => {
      if (updateInterval !== null) window.clearInterval(updateInterval);
      document.removeEventListener("visibilitychange", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
      window.removeEventListener("beforeinstallprompt", installAvailable);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[110] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-blue-400/30 bg-slate-950/95 p-3 text-sm text-slate-200 shadow-2xl backdrop-blur lg:bottom-4">
      <RefreshCw className="shrink-0 text-blue-300" size={19} />
      <p className="min-w-0 flex-1">Eine neue FRL-Version ist verfügbar.</p>
      <button
        type="button"
        className="min-h-11 shrink-0 rounded-xl bg-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white"
        onClick={() => {
          refreshRequested.current = true;
          waitingWorker.postMessage({ type: "SKIP_WAITING" });
        }}
      >
        Aktualisieren
      </button>
    </div>
  );
}
