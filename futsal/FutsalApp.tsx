// Futsal routes, all under the hash:
//   #futsal                          competitions
//   #futsal/rankings                 rankings
//   #futsal/t/<id>[/<tab>]           a competition
//   #futsal/t/<id>/m/<matchId>       match centre
//   #futsal/t/<id>/register          team registration
//   #futsal-score/<id>[/<matchId>]   scorer console
//   #futsal-obs/<id>/<matchId>       OBS scorebug for one match
//   #futsal-obs/<id>/court/<pitch>   OBS scorebug that follows the live match on a pitch
// Football uses the same routes under "#football".
import React, { lazy, Suspense, useEffect, useState } from 'react';
import './futsal.css';
import { Hub } from './ui/Hub';
import { Loading, Shell } from './ui/shared';

const TournamentPage = lazy(() => import('./ui/TournamentPage').then(m => ({ default: m.TournamentPage })));
const MatchCentre = lazy(() => import('./ui/MatchCentre').then(m => ({ default: m.MatchCentre })));
const Register = lazy(() => import('./ui/Register').then(m => ({ default: m.Register })));
const Scorer = lazy(() => import('./ui/Scorer').then(m => ({ default: m.Scorer })));
const Obs = lazy(() => import('./ui/Obs').then(m => ({ default: m.Obs })));

const parse = () => {
    let raw = window.location.hash;
    try { raw = decodeURIComponent(raw); } catch { /* keep raw */ }
    return raw.replace(/^#\/?/, '').split('?')[0].replace(/\/$/, '').split('/').filter(Boolean);
};

export const isFutsalRoute = (hash: string) => /^#?\/?(futsal|football)/.test(hash);

export const FutsalApp: React.FC<{ organiserSignedIn: boolean }> = ({ organiserSignedIn }) => {
    const [seg, setSeg] = useState(parse);
    useEffect(() => {
        const on = () => setSeg(parse());
        window.addEventListener('hashchange', on);
        return () => window.removeEventListener('hashchange', on);
    }, []);

    const [root, a, b, c, d] = seg;
    let page: React.ReactNode;
    if (/-obs$/.test(root) && a && b === 'court' && c) page = <Obs tournamentId={a} pitch={c} />;
    else if (/-obs$/.test(root) && a && b) page = <Obs tournamentId={a} matchId={b} />;
    else if (/-score$/.test(root) && a) page = <Scorer tournamentId={a} matchId={b} />;
    else if (a === 't' && b && c === 'm' && d) page = <MatchCentre tournamentId={b} matchId={d} />;
    else if (a === 't' && b && c === 'register') page = <Register tournamentId={b} />;
    else if (a === 't' && b) page = <TournamentPage id={b} tab={c} />;
    else page = <Hub />;

    return <Suspense fallback={/-obs$/.test(root) ? null : <Shell><div className="fx-wrap"><Loading /></div></Shell>}>{page}</Suspense>;
};

export default FutsalApp;
