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
    const MIN_DURATION_SECONDS = 90;

    // Päringute URL-id
    const LATEST_VIDEOS_URL = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=id&order=date&maxResults=15&type=video`;
    const POPULAR_VIDEO_URL = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=id&order=viewCount&maxResults=1&type=video`;

    try {
        // SAMM 1: Tee mõlemad otsingud (viimased ja popim) korraga
        const [latestSearchResponse, popularSearchResponse] = await Promise.all([
            fetch(LATEST_VIDEOS_URL),
            fetch(POPULAR_VIDEO_URL)
        ]);
        if (!latestSearchResponse.ok || !popularSearchResponse.ok) throw new Error('Youtube API error');
        
        const latestSearchData = await latestSearchResponse.json();
        const popularSearchData = await popularSearchResponse.json();

        // Kogu kokku kõik unikaalsed video ID-d
        const videoIds = new Set();
        latestSearchData.items.forEach(item => videoIds.add(item.id.videoId));
        popularSearchData.items.forEach(item => videoIds.add(item.id.videoId));
        
        const uniqueVideoIds = Array.from(videoIds).join(',');
        if (!uniqueVideoIds) return { statusCode: 200, body: JSON.stringify({ latestVideos: [], popularVideo: null }) };

        // SAMM 2: Küsi kõikide leitud videote detailsed andmed (sh pikkus)
        const DETAILS_URL = `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${uniqueVideoIds}&part=snippet,contentDetails,statistics`;
        const detailsResponse = await fetch(DETAILS_URL);
        if (!detailsResponse.ok) throw new Error('YouTube videos API error');
        const detailsData = await detailsResponse.json();

        // SAMM 3: Filtreeri videod pikkuse järgi
        const fullLengthVideos = detailsData.items.filter(video => {
            const durationInSeconds = parseDuration(video.contentDetails.duration);
            return durationInSeconds >= MIN_DURATION_SECONDS;
        });

        // Sorteeri videod uuesti kuupäeva järgi, et saada kätte kõige uuemad
        fullLengthVideos.sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt));
        
        // Leia kõige populaarsem video filtreeritud tulemuste seast
        let mostPopularVideo = null;
        if (fullLengthVideos.length > 0) {
            mostPopularVideo = fullLengthVideos.reduce((prev, current) => {
                return (parseInt(prev.statistics.viewCount) > parseInt(current.statistics.viewCount)) ? prev : current
            });
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                latestVideos: fullLengthVideos,
                popularVideo: mostPopularVideo
            })
        };
    } catch (error) {
        console.error('Error in Netlify function:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch video data.' }) };
    }
};
