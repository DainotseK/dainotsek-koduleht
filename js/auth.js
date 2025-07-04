let auth0Client = null;

// 1) Lae Auth0 config
async function fetchAuthConfig() {
  const res = await fetch("/.netlify/functions/getAuthConfig");
  if (!res.ok) throw new Error("Failed to load Auth0 config");
  return res.json();
}

// 2) Initsialiseeri Auth0 klient
async function configureClient() {
  const { domain, clientId } = await fetchAuthConfig();
  auth0Client = await createAuth0Client({
    domain,
    client_id: clientId,
    redirect_uri: window.location.origin
  });
}

// 3) Kuvab/peidab nupud ja sisu
async function updateUI() {
  const isAuthenticated = await auth0Client.isAuthenticated();
  document.getElementById("btn-login") .style.display = isAuthenticated ? "none" : "inline-block";
  document.getElementById("btn-signup").style.display = isAuthenticated ? "none" : "inline-block";
  document.getElementById("btn-logout").style.display = isAuthenticated ? "inline-block" : "none";
  document.getElementById("admin-button").style.display = isAuthenticated ? "inline-block" : "none";

  // Kaitse finance-lehte – kuva sisu ainult siis, kui sisse logitud
  if (location.pathname.includes("finance")) {
    const container = document.querySelector(".single-card-container");
    if (!isAuthenticated && container) {
      container.innerHTML = `
        <div class="brand-card">
          <h2>Restricted</h2>
          <div class="description">
            <p>This content is only available to logged-in users.</p>
          </div>
        </div>`;
    }
  }
}

// 4) Käivitus peale laadimist
window.onload = async () => {
  try {
    await configureClient();

    // Kui tulime Auth0-lt tagasi, käitle tagasisuunamise info
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
      // handleRedirectCallback annab appState-objekti
      const { appState } = await auth0Client.handleRedirectCallback();
      // aseta URL tagasi sinna, kust kasutaja saabus
      const target = appState && appState.target ? appState.target : "/";
      window.history.replaceState({}, document.title, target);
    }

    // Nüüd kuva uuendatud UI
    await updateUI();

    // Nupu sündmused
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

  } catch (err) {
    console.error("Auth init error:", err);
  }
};
