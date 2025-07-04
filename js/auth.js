// js/auth.js

let auth0Client;

// Kui DOM on valmis, initsialiseerime Auth0 ja UI
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1) Laeme Auth0 konfiguratsiooni
    const res = await fetch("/.netlify/functions/getAuthConfig");
    if (!res.ok) throw new Error("Cannot load Auth0 config");
    const { domain, clientId } = await res.json();

    // 2) Loon Auth0 kliendi
    auth0Client = await createAuth0Client({
      domain,
      client_id: clientId,
      cacheLocation: "localstorage",
      useRefreshTokens: true,
      redirect_uri: window.location.origin
    });

    // 3) Kui tulime Auth0 callback’ist, käitleme selle
    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
      const { appState } = await auth0Client.handleRedirectCallback();
      const target = appState && appState.target ? appState.target : "/";
      window.history.replaceState({}, document.title, target);
    }

    // 4) Uuendame UI ja sisu
    await updateUI();

    // 5) Registreerime nupuvajutused
    document.getElementById("btn-login")?.addEventListener("click", () =>
      auth0Client.loginWithRedirect({ appState: { target: window.location.pathname } })
    );
    document.getElementById("btn-signup")?.addEventListener("click", () =>
      auth0Client.loginWithRedirect({
        screen_hint: "signup",
        appState: { target: window.location.pathname }
      })
    );
    document.getElementById("btn-logout")?.addEventListener("click", () =>
      auth0Client.logout({ returnTo: window.location.origin })
    );

  } catch (err) {
    console.error("Auth init error:", err);
  }
});

// Kuvab või peidab nupud ning sisu vastavalt autentimise olekule
async function updateUI() {
  const isAuthenticated = await auth0Client.isAuthenticated();

  // Nupud
  document.getElementById("btn-login") .style.display = isAuthenticated ? "none" : "inline-block";
  document.getElementById("btn-signup").style.display = isAuthenticated ? "none" : "inline-block";
  document.getElementById("btn-logout").style.display = isAuthenticated ? "inline-block" : "none";
  document.getElementById("admin-button").style.display = isAuthenticated ? "inline-block" : "none";

  // Sisu konteinerid
  const contentEl    = document.getElementById("finance-content");
  const restrictedEl = document.getElementById("restricted-container");

  if (isAuthenticated) {
    contentEl.style.display    = "block";
    restrictedEl.style.display = "none";
  } else {
    contentEl.style.display    = "none";
    restrictedEl.style.display = "block";
  }
}
