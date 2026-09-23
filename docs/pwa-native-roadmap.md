# FRL PWA and native packaging roadmap

FRL Race Control remains a server-rendered Next.js application hosted on Vercel. The installable PWA is the supported app experience on Windows, Android, iPhone, and iPad today. It keeps Discord/Auth.js, authorization, finance, results, and mystery-race decisions on the server.

## Current install paths

- Windows and supported desktop browsers: install from the browser prompt or from **Settings → FRL App**.
- Android: install from Chrome/Edge when the browser offers the prompt.
- iPhone/iPad: open in Safari and choose **Share → Add to Home Screen**.
- The service worker stores only the explicit offline page, manifest, FRL logo, and install icons. Route payloads, API responses, authentication, finance, admin, results, and track assets are never written to the service-worker cache.

## Later Android APK/AAB

Capacitor is viable as a small, separate native shell that loads the canonical HTTPS Vercel deployment. A static export is not appropriate because this application relies on Server Components, Auth.js, Prisma, server actions, and protected dynamic data.

Create the wrapper in a dedicated `native/` workspace or a separate repository. Install `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android`, initialize the application id, then add Android. Configure the production `server.url` to the HTTPS FRL deployment, restrict navigation to the FRL host, and keep every secret on Vercel. Do not copy `DATABASE_URL`, `AUTH_SECRET`, Discord credentials, or Supabase service credentials into Android resources.

Android Studio can then produce:

- a signed APK for controlled testing or direct distribution;
- a signed AAB for Google Play Console distribution.

Release signing keys belong in a secure CI/keystore workflow, never in Git. Before store submission, add native deep-link/app-link handling and open Discord OAuth in the system browser. The existing mobile API and mobile-auth endpoints are the preferred foundation if the shell later needs fully native token handling.

## Later iOS shell

iOS is not an APK target. A Capacitor iOS shell requires macOS, Xcode, an Apple Developer account, an application identifier, signing profiles, and distribution through TestFlight or the App Store. The same hosted-shell and no-secrets rules apply. OAuth return handling should use Universal Links or a registered custom scheme and be verified against the existing Auth.js/mobile-auth callbacks.

Apple may reject a wrapper that offers no native value beyond a website, so store work should add appropriate native integration and complete App Store privacy disclosures. Until then, the PWA is the no-cost iPhone/iPad installation route.

## Native readiness checklist

1. Keep production functionality available through HTTPS and responsive down to 360 px.
2. Keep all authorization checks in server actions, route handlers, and the data-access layer.
3. Treat the native shell as an untrusted client; never embed backend secrets.
4. Verify Discord redirect URLs, Android App Links, and iOS Universal Links per release channel.
5. Test camera/file uploads, downloads, safe areas, keyboard behavior, logout, session expiry, and external links on physical devices.
6. Build and sign native packages only in the dedicated native workspace; the Vercel web application remains the source of truth.
