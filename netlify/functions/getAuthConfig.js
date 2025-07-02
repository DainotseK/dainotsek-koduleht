exports.handler = async function(event, context) {
    return {
        statusCode: 200,
        body: JSON.stringify({
            domain: process.env.AUTH0_DOMAIN,
            clientId: process.env.AUTH0_CLIENT_ID
        })
    };
};
