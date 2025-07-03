let auth0Client = null;

// Funktsioon, mis seadistab Auth0 kliendi. See käivitatakse alles siis, kui kõik on valmis.
const configureClient = async () => {
    try {
        const response = await fetch('/.netlify/functions/getAuthConfig');
        if (!response.ok) throw new Error('Could not fetch auth config.');
        const config = await response.json();
        
        auth0Client = await auth0.createAuth0Client({
            domain: config.domain,
            clientId: config.clientId,
            authorizationParams: {
                // Kasutame window.location.pathname, et see töötaks igal lehel korrektselt
                redirect_uri: window.location.origin + window.location.pathname
            }
        });
    } catch(e) {
        console.error("Auth0 initialization error", e);
    }
};

// Funktsioon, mis uuendab nuppude nähtavust
const updateUI = async () => {
    if (!auth0Client) return;
    try {
        const isAuthenticated = await auth0Client.isAuthenticated();
        document.getElementById('btn-login').style.display = isAuthenticated ? 'none' : 'block';
        document.getElementById('btn-logout').style.display = isAuthenticated ? 'block' : 'none';
    } catch(e) {
        console.error("UI update error", e);
    }
};

// Peamine funktsioon, mis käivitub pärast lehe laadimist
const main = async () => {
    await configureClient();

    const loginButton = document.getElementById('btn-login');
    const logoutButton = document.getElementById('btn-logout');

    loginButton.addEventListener('click', () => {
        if (auth0Client) auth0Client.loginWithRedirect();
    });

    logoutButton.addEventListener('click', () => {
        if (auth0Client) auth0Client.logout();
    });

    if (location.search.includes('state=') && location.search.includes('code=')) {
        await auth0Client.handleRedirectCallback();
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    updateUI();
};

// Ootame, kuni terve leht on laetud, ja alles siis käivitame oma loogika
window.addEventListener('load', main);
