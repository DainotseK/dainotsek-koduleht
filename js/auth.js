// js/auth.js

(function() {
  console.log("[AUTH DEBUG] Starting auth.js");

  let auth0Client = null;

  // 1) Laeme Auth0 konfi Netlify Function’ist
  async function fetchAuthConfig() {
    const url = "/.netlify/functions/getAuthConfig";
    console.log("[AUTH DEBUG] Fetching config from", url);
    const response = await fetch(url);
    console.log("[AUTH DEBUG] Config fetch status:", response.status);
    if (!response.ok) {
      throw new Error("Failed to load Auth0 config: " + response.status);
    }
    const cfg = await response.json();
    console.log("[AUTH DEBUG] Received config:", cfg);
    return cfg;
  }

  // 2) Initsialiseerime Auth0 kliendi
  async function initAuth0Client() {
    const { domain, clientId } = await fetchAuthConfig();
    console.log("[AUTH DEBUG] Initializing Auth0 client with", domain, clientId);
    auth0Client = await createAuth0Client({
      domain: domain,
      client_id: clientId,
      cacheLocation: "localstorage",
      useRefreshTokens: true,
      redirect_uri: window.location.origin
    });
    console.log("[AUTH DEBUG] Auth0 client ready");
  }

  // 3) Uuendame UI vastavalt kasutaja sisselogimise olekule
  async function updateUI() {
    if (!auth0Client) {
      console.log("[AUTH DEBUG] updateUI aborted: client not initialized");
      return;
    }
    const isAuthenticated = await auth0Client.isAuthenticated();
    console.log("[AUTH DEBUG] isAuthenticated:", isAuthenticated);

    const loginBtn  = document.getElementById("btn-login");
    const signupBtn = document.getElementById("btn-signup");
    const logoutBtn = document.getElementById("btn-logout");
    const adminBtn  = document.getElementById("admin-button");
    const restrictedEl = document.getElementById("restricted-container");
    const contentEl    = document.getElementById("finance-content");

    if (loginBtn)  loginBtn.style.display  = isAuthenticated ? "none" : "inline-block";
    if (signupBtn) signupBtn.style.display = isAuthenticated ? "none" : "inline-block";
    if (logoutBtn) logoutBtn.style.display = isAuthenticated ? "inline-block" : "none";
    if (adminBtn)  adminBtn.style.display  = isAuthenticated ? "inline-block" : "none";

    if (restrictedEl && contentEl) {
      restrictedEl.style.display = isAuthenticated ? "none" : "block";
      contentEl.style.display    = isAuthenticated ? "block" : "none";
    }
  }

  // 4) Registreerime nupu-klikid
  function setupEventHandlers() {
    document.getElementById("btn-login")?.addEventListener("click", () => {
      console.log("[AUTH DEBUG] Login clicked");
      auth0Client.loginWithRedirect({ appState: { target: window.location.pathname } });
    });

    document.getElementById("btn-signup")?.addEventListener("click", () => {
      console.log("[AUTH DEBUG] Signup clicked");
      auth0Client.loginWithRedirect({
        screen_hint: "signup",
        appState: { target: window.location.pathname }
      });
    });

    document.getElementById("btn-logout")?.addEventListener("click", () => {
      console.log("[AUTH DEBUG] Logout clicked");
      auth0Client.logout({ returnTo: window.location.origin });
    });
  }

  // 5) Käivitame kogu sisselogimise loogika peale window.load sündmust
  window.addEventListener("load", async () => {
    try {
      await initAuth0Client();

      // Kui tulime Auth0 redirect’i callback’ist
      if (
        window.location.search.includes("code=") &&
        window.location.search.includes("state=")
      ) {
        console.log("[AUTH DEBUG] Handling redirect callback...");
        const { appState } = await auth0Client.handleRedirectCallback();
        const target = appState?.target || "/";
        console.log("[AUTH DEBUG] Redirecting to:", target);
        window.history.replaceState({}, document.title, target);
      }

      await updateUI();
      setupEventHandlers();
    } catch (err) {
      console.error("[AUTH ERROR]", err);
    }
  });
})();
