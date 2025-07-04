// js/auth.js

// Logimise abiks
function log(...args) {
  console.log("[AUTH]", ...args);
}

let auth0Client = null;

// 1) Laeme Auth0 konfi
async function fetchAuthConfig() {
  log("Fetching Auth0 config...");
  const res = await fetch("/.netlify/functions/getAuthConfig");
  if (!res.ok) {
    throw new Error("Could not load Auth0 config: " + res.status);
  }
  const json = await res.json();
  log("Config loaded:", json);
  return json;
}

// 2) Initsialiseerime klienti
async function initAuth0() {
  const { domain, clientId } = await fetchAuthConfig();
  log("Initializing Auth0 client...");
  auth0Client = await createAuth0Client({
    domain,
    client_id: clientId,
    cacheLocation: "localstorage",
    useRefreshTokens: true,
    redirect_uri: window.location.origin
  });
  log("Auth0 client ready");
}

// 3) Uuendame nupud ja sisu
async function updateUI() {
  if (!auth0Client) {
    log("updateUI aborted: client not initialized");
    return;
  }
  const isAuth = await auth0Client.isAuthenticated();
  log("User authenticated?", isAuth);

  document.getElementById("btn-login") .style.display = isAuth ? "none" : "inline-block";
  document.getElementById("btn-signup").style.display = isAuth ? "none" : "inline-block";
  document.getElementById("btn-logout").style.display = isAuth ? "inline-block" : "none";
  document.getElementById("admin-button").style.display = isAuth ? "inline-block" : "none";

  const restrictedEl = document.getElementById("restricted-container");
  const contentEl    = document.getElementById("finance-content");

  if (isAuth) {
    restrictedEl.style.display = "none";
    contentEl.style.display    = "block";
  } else {
    restrictedEl.style.display = "block";
    contentEl.style.display    = "none";
  }
}

// 4) Käivime DOMContentLoaded ajal
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initAuth0();

    // callback käsitlemine
    if (window.location.search.includes("code=") &&
        window.location.search.includes("state=")) {
      log("Handling redirect callback...");
      const { appState } = await auth0Client.handleRedirectCallback();
      const target = appState?.target || "/";
      log("Redirecting to:", target);
      window.history.replaceState({}, document.title, target);
    }

    // esmane UI-uuendus
    await updateUI();

    // nupu sündmused
    document.getElementById("btn-login")?.addEventListener("click", () => {
      log("Login clicked");
      auth0Client.loginWithRedirect({
        appState: { target: window.location.pathname }
      });
    });

    document.getElementById("btn-signup")?.addEventListener("click", () => {
      log("SignUp clicked");
      auth0Client.loginWithRedirect({
        screen_hint: "signup",
        appState: { target: window.location.pathname }
      });
    });

    document.getElementById("btn-logout")?.addEventListener("click", () => {
      log("Logout clicked");
      auth0Client.logout({ returnTo: window.location.origin });
    });

  } catch (e) {
    console.error("[AUTH ERROR]", e);
  }
});
