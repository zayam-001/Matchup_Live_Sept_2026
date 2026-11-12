// OBS overlay pages must be see-through inside OBS (only the scorebug sits over the video), but in a
// normal browser a transparent page shows as white. OBS's browser source exposes `window.obsstudio`;
// `?transparent=1` on the link forces see-through anywhere (other streaming tools).
const THEME = 'radial-gradient(circle at 15% 0%, rgba(242, 107, 58, .16), transparent 45%), radial-gradient(circle at 100% 100%, rgba(79, 110, 247, .22), transparent 50%), linear-gradient(160deg, #020D45, #01082E 70%)';

export const isStreamingSource = () => {
    if (typeof window === 'undefined') return false;
    if ((window as any).obsstudio) return true;
    const q = window.location.hash.split('?')[1] || window.location.search.slice(1);
    return new URLSearchParams(q).get('transparent') === '1';
};

/** Set the page background for an overlay; returns a function that puts the old one back. */
export const applyOverlayBackground = () => {
    const html = document.documentElement.style, body = document.body.style;
    const prev = { html: html.background, body: body.background, attach: body.backgroundAttachment };
    const bg = isStreamingSource() ? 'transparent' : THEME;
    html.background = isStreamingSource() ? 'transparent' : '#01082E';
    body.background = bg;
    body.backgroundAttachment = 'fixed';
    return () => { html.background = prev.html; body.background = prev.body; body.backgroundAttachment = prev.attach; };
};
