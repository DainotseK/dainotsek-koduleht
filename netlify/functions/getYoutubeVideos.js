exports.handler = async function(event, context) {
    const API_KEY = process.env.YOUTUBE_API_KEY;
    const CHANNEL_ID = 'UCFiwaH41voe3jXqAZ2aqP1A';

    const LATEST_VIDEOS_URL = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=date&maxResults=15&type=video`;
    const POPULAR_VIDEO_URL = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=viewCount&maxResults=1&type=video`;

    try {
        // Teeme mõlemad päringud korraga, et olla kiirem
        const [latestResponse, popularResponse] = await Promise.all([
            fetch(LATEST_VIDEOS_URL),
            fetch(POPULAR_VIDEO_URL)
        ]);

        if (!latestResponse.ok || !popularResponse.ok) {
            console.error('YouTube API Error');
            return { statusCode: 500, body: JSON.stringify({ error: 'YouTube API error' }) };
        }

        const latestData = await latestResponse.json();
        const popularData = await popularResponse.json();

        // Filtreerime mõlemast tulemusest välja "Shorts" videod
        const filterShorts = (video) => {
            const thumbnail = video.snippet.thumbnails.default;
            return thumbnail.width >= thumbnail.height;
        };

        const latestVideos = latestData.items.filter(filterShorts);
        const popularVideo = popularData.items.filter(filterShorts);

        return {
            statusCode: 200,
            body: JSON.stringify({
                latestVideos: latestVideos,
                popularVideo: popularVideo[0] // Saadame ainult ühe popima video objekti
            })
        };
    } catch (error) {
        console.error('Error fetching from YouTube API:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch data.' }) };
    }
};
