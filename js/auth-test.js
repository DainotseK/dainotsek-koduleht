// See käivitub ainult siis, kui auth0-library.js on juba laetud
const runLoginTest = async () => {
    try {
        console.log('Test page: Attempting to configure Auth0 client...');

        const response = await fetch('/.netlify/functions/getAuthConfig');
        if (!response.ok) throw new Error('Could not fetch auth config.');
        const config = await response.json();

        const auth0Client = await auth0.createAuth0Client({
            domain: config.domain,
            clientId: config.clientId,
            authorizationParams: {
                // Pärast sisselogimist suunatakse tagasi avalehele
                redirect_uri: window.location.origin 
            }
        });

        console.log('Test page: Client configured. Redirecting to login...');
        await auth0Client.loginWithRedirect();

    } catch (e) {
        console.error("Auth0 test page error:", e);
        document.body.innerHTML = `<h1>Error during login test.</h1><p>Check the console (F12) for more details. The error is: "${e.message}"</p>`;
    }
};

// Käivitame testi
runLoginTest();
