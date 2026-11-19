/* ============================================================
   KASVIA — Install prompt UI
   Chrome/Edge/Android fire "beforeinstallprompt" when the manifest,
   icons, and service worker all pass installability checks. We
   capture that event and show our own button (browsers hide their
   native UI once you call preventDefault()), instead of leaving
   people to hunt for a hidden icon in the address bar.
   ============================================================ */

let _deferredInstallPrompt = null;
const INSTALL_DISMISS_KEY = "kasvia_install_dismissed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true; // iOS Safari
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isSecureOrigin() {
  return window.isSecureContext === true;
}

function installBannerHTML(mode) {
  if (mode === "prompt") {
    return `
      <div class="install-banner" id="installBanner">
        <div class="install-banner-text">
          <strong>Install KASVIA</strong>
          <span>Use it like a normal app — full screen, with its own icon.</span>
        </div>
        <div class="install-banner-actions">
          <button class="btn btn-gold btn-sm" id="installBtnGo">Install</button>
          <button class="btn btn-ghost btn-sm" id="installBtnLater">Not now</button>
        </div>
      </div>`;
  }
  if (mode === "ios") {
    return `
      <div class="install-banner" id="installBanner">
        <div class="install-banner-text">
          <strong>Add KASVIA to your Home Screen</strong>
          <span>Tap the Share icon <b>⬆️</b>, then "Add to Home Screen".</span>
        </div>
        <div class="install-banner-actions">
          <button class="btn btn-ghost btn-sm" id="installBtnLater">Got it</button>
        </div>
      </div>`;
  }
  if (mode === "insecure") {
    return `
      <div class="install-banner install-banner-warn" id="installBanner">
        <div class="install-banner-text">
          <strong>Can't install from this address</strong>
          <span>You're on ${esc(location.hostname)} over a plain network connection, so the
          browser won't allow a full app install here. Open KASVIA on the same computer that is
          running it (http://localhost:8080) to install there, or see "Installing on phones" in
          the manual for how to enable it on this device too.</span>
        </div>
        <div class="install-banner-actions">
          <button class="btn btn-ghost btn-sm" id="installBtnLater">Dismiss</button>
        </div>
      </div>`;
  }
  return "";
}

function injectInstallStyles() {
  if (document.getElementById("installBannerStyles")) return;
  const style = document.createElement("style");
  style.id = "installBannerStyles";
  style.textContent = `
    .install-banner{
      position:fixed; left:16px; right:16px; bottom:16px; z-index:500;
      max-width:520px; margin:0 auto;
      background:var(--panel,#fff); border:1px solid var(--line,#DDD9C8); border-radius:12px;
      box-shadow:0 10px 30px rgba(15,61,55,.25);
      padding:14px 16px; display:flex; align-items:center; gap:14px; flex-wrap:wrap;
    }
    .install-banner-warn{ border-color:#E3B98C; background:#FFF7EE; }
    .install-banner-text{ display:flex; flex-direction:column; gap:2px; flex:1; min-width:200px; }
    .install-banner-text strong{ font-size:.92rem; color:var(--forest-deep,#0A332C); }
    .install-banner-text span{ font-size:.8rem; color:var(--ink-soft,#4B5D58); line-height:1.35; }
    .install-banner-actions{ display:flex; gap:8px; flex-shrink:0; }
  `;
  document.head.appendChild(style);
}

function dismissInstallBanner() {
  const el = document.getElementById("installBanner");
  if (el) el.remove();
}

function showInstallBanner(mode) {
  if (isStandalone()) return; // already installed / running as an app
  if (sessionStorage.getItem(INSTALL_DISMISS_KEY) === "1") return;
  if (document.getElementById("installBanner")) return;
  injectInstallStyles();
  const wrap = document.createElement("div");
  wrap.innerHTML = installBannerHTML(mode);
  document.body.appendChild(wrap.firstElementChild);

  const laterBtn = document.getElementById("installBtnLater");
  if (laterBtn) laterBtn.addEventListener("click", () => {
    sessionStorage.setItem(INSTALL_DISMISS_KEY, "1");
    dismissInstallBanner();
  });

  const goBtn = document.getElementById("installBtnGo");
  if (goBtn) goBtn.addEventListener("click", async () => {
    if (!_deferredInstallPrompt) return;
    dismissInstallBanner();
    _deferredInstallPrompt.prompt();
    try { await _deferredInstallPrompt.userChoice; } catch (e) {}
    _deferredInstallPrompt = null;
  });
}

function initInstallPrompt() {
  // Real, working install: browser tells us it's ready.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    showInstallBanner("prompt");
  });

  window.addEventListener("appinstalled", () => {
    _deferredInstallPrompt = null;
    dismissInstallBanner();
  });

  if (isStandalone()) return;

  // iOS never fires beforeinstallprompt — Safari's own Share-sheet flow is the
  // only way in, so guide people there instead of showing a dead button.
  if (isIOS()) {
    setTimeout(() => showInstallBanner("ios"), 1200);
    return;
  }

  // Chrome/Edge on a non-secure origin (e.g. a phone on http://192.168.x.x)
  // will never fire beforeinstallprompt — explain why, rather than staying silent.
  if (!isSecureOrigin() && "serviceWorker" in navigator) {
    setTimeout(() => {
      if (!_deferredInstallPrompt) showInstallBanner("insecure");
    }, 2500);
  }
}
