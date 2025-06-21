exports.handler = async function(event, context) {
    const API_KEY = process.env.YOUTUBE_API_KEY;
    
    const playlists = [
        { id: 'PL-kPLkM6T7tOSNeYwEWGexl_fLYWvQris', title: 'Gaming' },
        { id: 'PL-kPLkM6T7tPTpZ93ds4vcakSQa4-u9wp', title: 'Nature' },
        { id: 'PL-kPLkM6T7tNkcX0jGkQJeDa0T_qbOvNF', title: 'Drone' },
        { id: 'PL-kPLkM6T7tPbqSPmkRbLB9uZuXwZa1Mj', title: 'Timelapse' }
    ];

    const fetchPlaylistItems = async (playlistId) => {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?key=${API_KEY}&playlistId=${playlistId}&part=snippet&maxResults=10`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error fetching playlist ${playlistId}: ${response.statusText}`);
            return []; // Tagastame tühja massiivi vea korral
        }
        const data = await response.json();
        return data.items;
    };

    try {
        const allPlaylistsData = await Promise.all(
            playlists.map(p => fetchPlaylistItems(p.id))
        );

        const result = playlists.map((playlistInfo, index) => {
            const videos = allPlaylistsData[index];

            // Filtreerime välja "Shorts" videod
            const filteredVideos = videos.filter(video => {
                const thumbnail = video.snippet.thumbnails.default;
                const title = video.snippet.title.toLowerCase();
                return thumbnail && thumbnail.width >= thumbnail.height && !title.includes('#shorts');
            }).slice(0, 4); // Võtame kuni 4 videot

            return {
                title: playlistInfo.title,
                videos: filteredVideos
            };
        });

        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };
    } catch (error) {
        console.error('Error in Netlify function:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch video data.' }) };
    }
};
