// js/auth.js

let auth0Client;

// Laeme Auth0 seaded
async function fetchAuthConfig() {
  const res = await fetch("/.netlify/functions/getAuthConfig");
  if (!res.ok) throw new Error("Cannot load Auth0 config");
  return res.json();
}

// Initsialiseerime Reacti DOMContentLoadediga, mitte window.onload’iga
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { domain, clientId } = await fetchAuthConfig();

    auth0Client = await createAuth0Client({
      domain,
      client_id: clientId,
      cacheLocation: "localstorage",       // salvestame token’i LocalStorage’i
      useRefreshTokens: true,              // kasutame refresh token’e
      redirect_uri: window.location.origin
    });

    // Kui tulime Auth0 callback’ist
    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
      const { appState } = await auth0Client.handleRedirectCallback();
      // suuname tagasi algsele lehele või avalehele
      const target = appState?.target || "/";
      window.history.replaceState({}, document.title, target);
    }

    // Nüüd uuendame UI
    await updateUI();

    // Registreerime nupuvajutused
    document.getElementById("btn-login")?.addEventListener("click", () => {
      auth0Client.loginWithRedirect({
        appState: { target: window.location.pathname }
      });
    });
    document.getElementById("btn-signup")?.addEventListener("click", () => {
      auth0Client.loginWithRedirect({
        screen_hint: "signup",
        appState: { target: window.location.pathname }
      });
    });
    document.getElementById("btn-logout")?.addEventListener("click", () => {
      auth0Client.logout({ returnTo: window.location.origin });
    });
  } catch (e) {
    console.error("Auth init error:", e);
  }
});

// Kuvame või peidame nupud ja sisu
async function updateUI() {
  const isAuthenticated = await auth0Client.isAuthenticated();

  // Nupud
  document.getElementById("btn-login") .style.display = isAuthenticated ? "none" : "inline-block";
  document.getElementById("btn-signup").style.display = isAuthenticated ? "none" : "inline-block";
  document.getElementById("btn-logout").style.display = isAuthenticated ? "inline-block" : "none";
  document.getElementById("admin-button").style.display = isAuthenticated ? "inline-block" : "none";

  // Kaitstame /finance sisu
  if (location.pathname.includes("finance")) {
    const container = document.querySelector(".single-card-container");
    if (!isAuthenticated) {
      container.innerHTML = `
        <div class="brand-card">
          <h2>Restricted</h2>
          <div class="description"><p>This content is only available to logged-in users.</p></div>
        </div>`;
    } else {
      // Kui tahad dünaamiliselt laadida päris sisu, saad siia fetchi panna
      // praegu kuvame staatiliselt olemasoleva markup’i
      container.innerHTML = `
        <div class="brand-card">
          <h2>Financial Overview</h2>
          <div class="description">
            <p>Transparent and honest overview of my journey in the financial world.</p>
            <ul>
              <li>Investment Portfolio Overviews</li>
              <li>Analyses and Transaction Log</li>
              <li>Blog on Financial Literacy</li>
            </ul>
          </div>
        </div>`;
    }
  }
}
