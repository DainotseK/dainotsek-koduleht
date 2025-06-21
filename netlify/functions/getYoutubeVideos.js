exports.handler = async function(event, context) {
    const API_KEY = process.env.YOUTUBE_API_KEY;
    const CHANNEL_ID = 'UCFiwaH41voe3jXqAZ2aqP1A';

    // Eemaldasime '&videoDuration=medium' parameetri, et saada kätte kõik videod
    const LATEST_VIDEOS_URL = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=date&maxResults=20&type=video`;
    const POPULAR_VIDEO_URL = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=viewCount&maxResults=5&type=video`;

    try {
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

        return {
            statusCode: 200,
            body: JSON.stringify({
                latestVideos: latestData.items,
                popularVideo: popularData.items[0]
            })
        };
    } catch (error) {
        console.error('Error fetching from YouTube API:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch data.' }) };
    }
};
