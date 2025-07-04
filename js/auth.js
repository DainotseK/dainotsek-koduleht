let auth0Client = null;

async function fetchAuthConfig() {
  const res = await fetch("/.netlify/functions/getAuthConfig");
  if (!res.ok) throw new Error("Could not load Auth0 config");
  return res.json();
}

async function configureClient() {
  const { domain, clientId } = await fetchAuthConfig();
  auth0Client = await createAuth0Client({
    domain,
    client_id: clientId,
    redirect_uri: window.location.origin
  });
}

async function updateUI() {
  const isAuthenticated = await auth0Client.isAuthenticated();
  document.getElementById("btn-login").style.display  = isAuthenticated ? "none" : "inline-block";
  document.getElementById("btn-logout").style.display = isAuthenticated ? "inline-block" : "none";
  document.getElementById("admin-button").style.display= isAuthenticated ? "inline-block" : "none";

  if (location.pathname.includes("admin") && !isAuthenticated) location.href = "/";
  if (location.pathname.includes("finance") && !isAuthenticated) {
    document.querySelector(".single-card-container").innerHTML = `
      <div class="brand-card">
        <h2>Restricted</h2>
        <div class="description">
          <p>This content is only available to logged-in users.</p>
        </div>
      </div>`;
  }
}

window.onload = async () => {
  try {
    await configureClient();
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
      await auth0Client.handleRedirectCallback();
      history.replaceState({}, document.title, "/");
    }
    await updateUI();
    document.getElementById("btn-login") .addEventListener("click", () => auth0Client.loginWithRedirect());
    document.getElementById("btn-logout").addEventListener("click", () => 
      auth0Client.logout({ returnTo: location.origin })
    );
  } catch (e) {
    console.error("Auth error:", e);
  }
};
