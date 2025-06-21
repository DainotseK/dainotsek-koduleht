exports.handler = async function(event, context) {
    const API_KEY = process.env.YOUTUBE_API_KEY;
    const CHANNEL_ID = 'UCFiwaH41voe3jXqAZ2aqP1A'; // Sinu Channel ID, mille sa mulle andsid
    const MAX_RESULTS = 9; // Mitu videot soovime kuvada

    const url = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=date&maxResults=${MAX_RESULTS}&type=video`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Kui YouTube vastab veaga, logime selle välja
            const errorData = await response.json();
            console.error('YouTube API Error:', errorData);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: `YouTube API error: ${response.statusText}` })
            };
        }

        const data = await response.json();

        return {
            statusCode: 200,
            body: JSON.stringify(data.items)
        };
    } catch (error) {
        console.error('Error fetching from YouTube API:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Could not fetch data from YouTube API.' })
        };
    }
};