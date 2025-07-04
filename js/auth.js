// js/auth.js

console.log("[AUTH DEBUG] Starting auth.js");

let auth0Client = null;

// 1) Laeme Auth0 konfi Netlify Function’ist
async function fetchAuthConfig() {
  const url = "/.netlify/functions/getAuthConfig";
  console.log("[AUTH DEBUG] Fetching config from", url);
  const res = await fetch(url);
  console.log("[AUTH DEBUG] Config fetch status", res.status);
  if (!res.ok) {
    throw new Error("Auth config load failed: " + res.status);
  }
  const data = await res.json();
  console.log("[AUTH DEBUG] Received config", data);
  return data;
}

// 2) Initsialiseerime Auth0 kliendi
async function configureClient() {
  const { domain, clientId } = await fetchAuthConfig();
  console.log("[AUTH DEBUG] Initializing Auth0 with", domain, clientId);
  auth0Client = await createAuth0Client({
    domain,
    client_id: clientId,
    cacheLocation: "localstorage",
    useRefreshTokens: true,
    redirect_uri: window.location.origin
  });
  console.log("[AUTH DEBUG] Auth0 client ready");
}

// 3) Kuvame või peidame nupud ja sisu olenevalt sisselogimisest
async function updateUI() {
  if (!auth0Client) {
    console.log("[AUTH DEBUG] updateUI aborted: client not initialized");
    return;
  }
  const isAuthenticated = await auth0Client.isAuthenticated();
  console.log("[AUTH DEBUG] User authenticated?", isAuthenticated);

  document.getElementById("btn-login")?.style.display  = isAuthenticated ? "none" : "inline-block";
  document.getElementById("btn-signup")?.style.display = isAuthenticated ? "none" : "inline-block";
  document.getElementById("btn-logout")?.style.display = isAuthenticated ? "inline-block" : "none";
  document.getElementById("admin-button")?.style.display = isAuthenticated ? "inline-block" : "none";

  const restrictedEl = document.getElementById("restricted-container");
  const contentEl    = document.getElementById("finance-content");

  if (isAuthenticated) {
    restrictedEl.style.display = "none";
    contentEl.style.display    = "block";
  } else {
    restrictedEl.style.display = "block";
    contentEl.style.display    = "none";
  }
}

// 4) Kõik käivitub peale window.load sündmust, et DOM on olemas
window.onload = async () => {
  try {
    await configureClient();

    // Kui tulime Auth0 callback’ist, käitleme ümber suunamise
    if (window.location.search.includes("code=") &&
        window.location.search.includes("state=")) {
      console.log("[AUTH DEBUG] Handling redirect callback...");
      const { appState } = await auth0Client.handleRedirectCallback();
      const target = appState?.target || "/";
      console.log("[AUTH DEBUG] Redirecting to:", target);
      window.history.replaceState({}, document.title, target);
    }

    await updateUI();

    // Nupu click-handler’id
    document.getElementById("btn-login")?.addEventListener("click", () => {
      console.log("[AUTH DEBUG] Login clicked");
      auth0Client.loginWithRedirect({ appState: { target: window.location.pathname } });
    });

    document.getElementById("btn-signup")?.addEventListener("click", () => {
      console.log("[AUTH DEBUG] SignUp clicked");
      auth0Client.loginWithRedirect({
        screen_hint: "signup",
        appState: { target: window.location.pathname }
      });
    });

    document.getElementById("btn-logout")?.addEventListener("click", () => {
      console.log("[AUTH DEBUG] Logout clicked");
      auth0Client.logout({ returnTo: window.location.origin });
    });

  } catch (err) {
    console.error("[AUTH ERROR]", err);
  }
};
