"use client";

import { Download, MonitorSmartphone, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  PWA_INSTALL_AVAILABLE_EVENT,
  PWA_INSTALLED_EVENT,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa/client";

const IOS_GUIDE_DISMISSED_KEY = "frl-pwa-ios-guide-dismissed";

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosSafari(): boolean {
  const userAgent = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios
    && /Safari/.test(userAgent)
    && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}

export default function PwaInstallPanel() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const syncState = () => {
      const standalone = isStandalone();
      setInstalled(standalone);
      setPrompt(window.__frlInstallPrompt ?? null);
      setShowIosGuide(
        !standalone
          && isIosSafari()
          && localStorage.getItem(IOS_GUIDE_DISMISSED_KEY) !== "1",
      );
    };
    syncState();
    window.addEventListener(PWA_INSTALL_AVAILABLE_EVENT, syncState);
    window.addEventListener(PWA_INSTALLED_EVENT, syncState);
    return () => {
      window.removeEventListener(PWA_INSTALL_AVAILABLE_EVENT, syncState);
      window.removeEventListener(PWA_INSTALLED_EVENT, syncState);
    };
  }, []);

  async function install(): Promise<void> {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // A beforeinstallprompt event can only be used once, even when dismissed.
    delete window.__frlInstallPrompt;
    setPrompt(null);
  }

  function dismissIosGuide(): void {
    localStorage.setItem(IOS_GUIDE_DISMISSED_KEY, "1");
    setShowIosGuide(false);
  }

  if (!prompt && !showIosGuide && !installed) return null;

  return (
    <section className="master-card" aria-labelledby="frl-app-title">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-500/15 p-3 text-blue-300">
          <MonitorSmartphone size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="frl-app-title" className="text-xl font-semibold text-white">FRL App</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Race Control im eigenen App-Fenster öffnen – mit demselben sicheren FRL-Konto.
          </p>
        </div>
        {showIosGuide ? (
          <button
            type="button"
            aria-label="Installationshinweis ausblenden"
            onClick={dismissIosGuide}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      {prompt ? (
        <button type="button" onClick={() => void install()} className="wizard-primary-button mt-5 w-full sm:w-auto">
          <Download size={18} />
          FRL App installieren
        </button>
      ) : null}

      {showIosGuide ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-300">
          <Share2 className="mt-0.5 shrink-0 text-blue-300" size={19} />
          <p>In Safari auf <strong className="text-white">Teilen</strong> tippen und anschließend <strong className="text-white">Zum Home-Bildschirm</strong> wählen.</p>
        </div>
      ) : null}

      {installed ? (
        <p className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          FRL Race Control läuft bereits als installierte App.
        </p>
      ) : null}
    </section>
  );
}
