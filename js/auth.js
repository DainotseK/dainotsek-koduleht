// js/auth.js
window.onload = async () => {
  const loginBtn     = document.getElementById("btn-login");
  const signupBtn    = document.getElementById("btn-signup");
  const logoutBtn    = document.getElementById("btn-logout");
  const adminBtn     = document.getElementById("admin-button");
  const restrictedEl = document.getElementById("restricted-container");
  const contentEl    = document.getElementById("finance-content");

  try {
    // 1) Lae Auth0-konfig
    const confRes = await fetch("/.netlify/functions/getAuthConfig");
    if (!confRes.ok) throw new Error("Auth config failed");
    const { domain, clientId } = await confRes.json();

    // 2) Initsialiseeri Auth0 klient
    const auth0Client = await createAuth0Client({
      domain,
      client_id: clientId,
      cacheLocation: "localstorage",
      useRefreshTokens: true,
      redirect_uri: window.location.origin
    });

    // 3) Kui tulime callback’ist, käitle ja puhasta URL
    if (window.location.search.includes("code=") &&
        window.location.search.includes("state=")) {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 4) Kontrolli auth-seisu
    const isAuth = await auth0Client.isAuthenticated();

    // 5) Uuenda UI
    loginBtn.style.display     = isAuth ? "none" : "inline-block";
    signupBtn.style.display    = isAuth ? "none" : "inline-block";
    logoutBtn.style.display    = isAuth ? "inline-block" : "none";
    adminBtn.style.display     = isAuth ? "inline-block" : "none";
    restrictedEl.style.display = isAuth ? "none" : "block";
    contentEl.style.display    = isAuth ? "block" : "none";

    // 6) Sündmuse kuulajad
    loginBtn.onclick = () =>
      auth0Client.loginWithRedirect({ appState: { target: window.location.pathname } });

    signupBtn.onclick = () =>
      auth0Client.loginWithRedirect({
        screen_hint: "signup",
        appState: { target: window.location.pathname }
      });

    logoutBtn.onclick = () =>
      auth0Client.logout({ returnTo: window.location.origin });
  } catch (e) {
    console.error("Auth error:", e);
  }
};
