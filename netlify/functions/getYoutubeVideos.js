// Helper-funktsioon, mis muudab YouTube'i ajaformaadi (nt "PT1M45S") sekunditeks
function parseDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return hours * 3600 + minutes * 60 + seconds;
}

exports.handler = async function(event, context) {
    const API_KEY = process.env.YOUTUBE_API_KEY;
    const CHANNEL_ID = 'UCFiwaH41voe3jXqAZ2aqP1A';
    const MIN_DURATION_SECONDS = 90; // 1 minut ja 30 sekundit

    const SEARCH_URL = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=id&order=date&maxResults=20&type=video`;

    try {
        // SAMM 1: Leia viimaste videote ID-d
        const searchResponse = await fetch(SEARCH_URL);
        if (!searchResponse.ok) throw new Error('Youtube API error');
        const searchData = await searchResponse.json();

        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        if (!videoIds) return { statusCode: 200, body: JSON.stringify([]) };

        // SAMM 2: Küsi leitud videote detailsed andmed (sh pikkus)
        const DETAILS_URL = `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoIds}&part=snippet,contentDetails`;
        const detailsResponse = await fetch(DETAILS_URL);
        if (!detailsResponse.ok) throw new Error('YouTube videos API error');
        const detailsData = await detailsResponse.json();

        // SAMM 3: Filtreeri videod pikkuse järgi
        const filteredVideos = detailsData.items.filter(video => {
            const durationInSeconds = parseDuration(video.contentDetails.duration);
            return durationInSeconds >= MIN_DURATION_SECONDS;
        });

        return {
            statusCode: 200,
            body: JSON.stringify(filteredVideos) // Saadame ainult filtreeritud videod
        };
    } catch (error) {
        console.error('Error in Netlify function:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch video data.' }) };
    }
};
