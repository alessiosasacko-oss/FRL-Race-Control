export const PWA_INSTALL_AVAILABLE_EVENT = "frl:pwa-install-available";
export const PWA_INSTALLED_EVENT = "frl:pwa-installed";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __frlInstallPrompt?: BeforeInstallPromptEvent;
  }
}
