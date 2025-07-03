let auth0Client = null;

// Funktsioon, mis seadistab Auth0 kliendi
const configureClient = async () => {
    try {
        const response = await fetch('/.netlify/functions/getAuthConfig');
        if (!response.ok) throw new Error('Could not fetch auth config.');
        const config = await response.json();
        
        auth0Client = await auth0.createAuth0Client({
            domain: config.domain,
            clientId: config.clientId,
            authorizationParams: {
                redirect_uri: window.location.origin
            }
        });
    } catch(e) {
        console.error("Auth0 initialization error", e);
    }
};

// Funktsioon, mis uuendab nuppude välimust vastavalt sisselogimise staatusele
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

// See funktsioon käivitub, kui leht on täielikult laetud
window.onload = async () => {
    await configureClient();
    
    // Käsitseme tagasisuunamist pärast sisselogimist
    if (location.search.includes('state=') && location.search.includes('code=')) {
        await auth0Client.handleRedirectCallback();
        // Puhastame URL-i ja suuname avalehele, et vältida vigu
        window.history.replaceState({}, document.title, "/");
    }

    updateUI();

    // Seome nupud tegevustega
    document.getElementById('btn-login').addEventListener('click', () => {
        if (auth0Client) auth0Client.loginWithRedirect();
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        if (auth0Client) auth0Client.logout();
    });
};
