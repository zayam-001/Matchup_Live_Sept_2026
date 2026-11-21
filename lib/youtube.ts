// Live video for a court: the organiser pastes the YouTube Live link of that court's stream (e.g. Maidan TV)
// and Match Up plays it inside the page. A channel link always plays whatever the channel is streaming now.

/** The embed address for a YouTube link, or null when it isn't one we can play. */
export const youtubeEmbed = (url?: string | null, opts: { mute?: boolean; bare?: boolean } = {}): string | null => {
    const u = String(url || '').trim();
    if (!u) return null;
    // `bare`: no YouTube controls, captions or annotations, and the JS API on so our own buttons drive it.
    const bare = opts.bare ? `&controls=0&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://matchup.com.pk')}` : '';
    const params = `autoplay=1&playsinline=1&rel=0&modestbranding=1${opts.mute ? '&mute=1' : ''}${bare}`;
    // Channel: youtube.com/channel/UC... -> the channel's current live stream.
    const channel = u.match(/youtube\.com\/channel\/(UC[\w-]{20,})/i);
    if (channel) return `https://www.youtube.com/embed/live_stream?channel=${channel[1]}&${params}`;
    // A video: watch?v=, youtu.be/, /live/, /embed/, /shorts/.
    const video = u.match(/(?:[?&]v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([\w-]{11})(?![\w-])/i);
    return video ? `https://www.youtube.com/embed/${video[1]}?${params}` : null;
};

/** Why a pasted link won't play, for the organiser (null when it's fine or empty). */
export const youtubeLinkProblem = (url?: string | null): string | null => {
    const u = String(url || '').trim();
    if (!u || youtubeEmbed(u)) return null;
    if (/youtube\.com\/@/i.test(u)) return 'Channel @handle links can\'t be embedded: paste the live video link, or the youtube.com/channel/UC… link';
    return 'Not a YouTube video or channel link';
};

/** The stream for a match's court, if the tournament has one. Courts are matched by name, ignoring case. */
export const courtStream = (streams: Record<string, string> | undefined, ...courts: (string | undefined | null)[]): string | null => {
    if (!streams) return null;
    const byName = Object.fromEntries(Object.entries(streams).map(([k, v]) => [k.trim().toLowerCase(), v]));
    for (const c of courts) {
        const s = c && byName[String(c).trim().toLowerCase()];
        if (s && youtubeEmbed(s)) return s;
    }
    return null;
};
