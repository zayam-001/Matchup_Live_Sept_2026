import React, { useMemo } from 'react';
import { CalendarDays, MapPin, Trophy as TrophyIcon, Users } from 'lucide-react';
import { FUTSAL_RANKING } from '../../lib/pointsSystems';
import { PRESETS } from '../presets';
import { Ball, dateRange, Empty, Loading, MatchRow, Shell, Star, useAllFutsal, useNow } from './shared';

export const Hub: React.FC = () => {
    const { tournaments, teams, matches, loading } = useAllFutsal();
    const now = useNow(1000);
    const visible = useMemo(() => tournaments.filter(t => t.status !== 'DRAFT')
        .sort((a, b) => (a.status === 'COMPLETED' ? 1 : 0) - (b.status === 'COMPLETED' ? 1 : 0) || b.startDate.localeCompare(a.startDate)), [tournaments]);
    const live = matches.filter(m => m.status === 'LIVE');

    return (
        <Shell active="home">
            <div className="fx-wrap">
                <section className="fx-hero">
                    <div className="fx-hero__ring" aria-hidden="true" />
                    <span className="fx-eyebrow"><Star /> Match Up Futsal</span>
                    <h1 style={{ marginTop: 14 }}>Every match.<br /><em>Under the lights.</em></h1>
                    <p>Live scores, group tables, brackets and player stats for futsal across Pakistan: 5v5, 6v6, 7v7 and every format in between.</p>
                    <div className="fx-hero__actions">
                        <a className="fx-btn fx-btn--primary" href="#admin">Host a tournament</a>
                        <a className="fx-btn" href="#futsal/rankings">Rankings</a>
                    </div>
                </section>

                {live.length > 0 && (
                    <section className="fx-section">
                        <div className="fx-section__head"><h2>Live now</h2><span className="fx-pill fx-pill--live">{live.length} live</span></div>
                        <div className="fx-matches">
                            {live.map(m => {
                                const t = tournaments.find(x => x.id === m.tournamentId);
                                return t ? <MatchRow key={m.id} m={m} t={t} teams={teams} matches={matches} now={now} showCat /> : null;
                            })}
                        </div>
                    </section>
                )}

                <section className="fx-section">
                    <div className="fx-section__head"><h2>Competitions</h2></div>
                    {loading ? <Loading /> : !visible.length ? (
                        <Empty title="No competitions yet">Organisers can set one up in a few minutes from Organise.</Empty>
                    ) : (
                        <div className="fx-comps">
                            {visible.map(t => {
                                const n = teams.filter(x => x.tournamentId === t.id && x.status === 'ACCEPTED').length;
                                const tLive = matches.some(m => m.tournamentId === t.id && m.status === 'LIVE');
                                const formats = [...new Set(t.categories.map(c => PRESETS[c.rules.preset]?.label.replace(' FIFA Futsal', ' FIFA') || 'Custom'))];
                                return (
                                    <a key={t.id} className="fx-card fx-comp" href={`#futsal/t/${t.id}`}>
                                        <span className="fx-comp__glow" aria-hidden="true" />
                                        <div className="fx-comp__meta">
                                            {tLive ? <span className="fx-pill fx-pill--live">Live</span>
                                                : t.status === 'COMPLETED' ? <span className="fx-pill">Finished</span>
                                                    : t.status === 'REGISTRATION' ? <span className="fx-pill fx-pill--ok">Registration open</span>
                                                        : <span className="fx-pill">Upcoming</span>}
                                            <span className="fx-pill fx-pill--gold">{FUTSAL_RANKING.label}</span>
                                            {formats.map(f => <span key={f} className="fx-pill">{f}</span>)}
                                        </div>
                                        <h3>{t.name}</h3>
                                        <div className="fx-muted" style={{ display: 'grid', gap: 6, fontSize: 14 }}>
                                            <span><CalendarDays size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{dateRange(t)}</span>
                                            <span><MapPin size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{[t.venue, t.city].filter(Boolean).join(', ')}</span>
                                        </div>
                                        <div className="fx-comp__foot">
                                            <span><Users size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{n} teams · {t.categories.length} {t.categories.length === 1 ? 'category' : 'categories'}</span>
                                            <span style={{ color: 'var(--fx-cyan)', fontWeight: 700 }}>Open →</span>
                                        </div>
                                    </a>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="fx-section">
                    <div className="fx-grid3">
                        {[
                            { icon: <Ball />, title: 'Live match centre', copy: 'Running clock, team fouls, cards and every goal with its scorer, as it happens.' },
                            { icon: <TrophyIcon />, title: 'Tables and brackets', copy: 'Group standings update live with head-to-head tiebreakers, straight into the knockout draw.' },
                            { icon: <Star />, title: 'Golden Boot and more', copy: 'Top scorers, assists, clean sheets and fair play, per tournament and across the season.' },
                        ].map(f => (
                            <div key={f.title} className="fx-card fx-card--pad">
                                <span className="fx-award__icon">{f.icon}</span>
                                <h3 style={{ fontSize: 22, margin: '14px 0 6px' }}>{f.title}</h3>
                                <p className="fx-muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{f.copy}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </Shell>
    );
};
