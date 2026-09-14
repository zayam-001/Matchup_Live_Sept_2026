import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, onSnapshot, collectionGroup } from 'firebase/firestore';
import { db } from '../services/storage';

// Internal QA/dev tournaments (created for testing, not real client events)
// polluted these stats - e.g. one QA run alone added a fully-scheduled
// 8-team tournament to the public "tournaments hosted" count. Filtering by
// name/organizer keeps the platform's public numbers honest without needing
// to delete the underlying test data.
export const isTestTournament = (data: any): boolean => {
    const name = String(data?.name || '').trim().toLowerCase();
    const organizerEmail = String(data?.organizerEmail || '').trim().toLowerCase();
    if (organizerEmail.includes('qa-test') || organizerEmail.includes('@example.com')) return true;
    if (/^(qa\b|test\b|test\d|test-)/i.test(name)) return true;
    return false;
};

// Bulk-seeded placeholder accounts (name literally "Player 123") from early
// development/demo data - these aren't real signups and shouldn't count
// toward a public "active players" number.
const isPlaceholderPlayer = (data: any): boolean => {
    const name = String(data?.name || data?.playerName || '').trim();
    return /^Player \d+$/i.test(name);
};

export const usePlatformStats = () => {
    const [stats, setStats] = useState({
        activePlayers: 0,
        matchesLive: 0,
        tournamentsHosted: 0,
        rankingsUpdated: 0,
        totalMatchesPlayed: 0,
        activeClubs: 0,
        monthlyTournaments: 0,
        userGrowth: 0
    });

    useEffect(() => {
        let mounted = true;
        if (!db) return;

        const unsubPlayers = onSnapshot(collection(db, 'leaderboard'), (snap) => {
            const rawEntries = snap.docs.map(doc => {
                const d = doc.data();
                return {
                    name: (d.playerName || 'Unknown').trim(),
                    matchesPlayed: d.matchesPlayed || 0,
                    lastUpdatedMs: d.lastUpdated?.toMillis ? d.lastUpdated.toMillis() : 0,
                };
            });
            const byName = new Map();
            for (const entry of rawEntries) {
                const key = entry.name.toLowerCase();
                const existing = byName.get(key);
                if (!existing) {
                    byName.set(key, entry);
                    continue;
                }
                const entryIsBetter = entry.matchesPlayed !== existing.matchesPlayed
                    ? entry.matchesPlayed > existing.matchesPlayed
                    : entry.lastUpdatedMs > existing.lastUpdatedMs;
                if (entryIsBetter) byName.set(key, entry);
            }
            if (mounted) {
                setStats(prev => ({ ...prev, activePlayers: byName.size }));
            }
        });

        const unsubMatches = onSnapshot(collectionGroup(db, 'matches'), (snap) => {
            // FIX (client feedback: stats should reflect real, actual
            // activity): this counted every match doc regardless of status,
            // so "matches organized"/"total matches played" included
            // matches that were merely scheduled and never played - a
            // tournament with a full future schedule inflated this the
            // moment it was created. Now only matches that actually
            // finished count.
            const completedMatches = snap.docs.filter(m => {
                const status = String(m.data().status || '').toUpperCase();
                return status === 'COMPLETED' || status === 'FINISHED';
            }).length;
            const liveMatches = snap.docs.filter(m => {
                const data = m.data();
                return data.status === 'IN_PROGRESS' || data.status === 'live';
            }).length;
            if (mounted) {
                setStats(prev => ({ ...prev, totalMatchesPlayed: completedMatches, matchesLive: liveMatches }));
            }
        });

        const unsubTournaments = onSnapshot(collection(db, 'tournaments'), (snap) => {
            const realTournaments = snap.docs.filter(d => !isTestTournament(d.data()));
            if (mounted) {
                setStats(prev => ({ ...prev, tournamentsHosted: realTournaments.length }));
            }
        });

        const fetchStats = async () => {
            try {
                let clubs = new Set();
                let monthlyT = 0;

                const now = new Date();
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(now.getMonth() - 1);

                const tSnap = await getDocs(collection(db, 'tournaments'));
                for (const doc of tSnap.docs) {
                    const data = doc.data();
                    if (isTestTournament(data)) continue;
                    if (data.venue) clubs.add(data.venue);
                    if (data.createdAt) {
                        const cDate = new Date(data.createdAt);
                        if (cDate > oneMonthAgo) monthlyT++;
                    } else {
                        monthlyT++; // assume recent if no date
                    }
                }

                // FIX (client feedback: numbers/stats need to be real, not
                // fake): this was a hardcoded `38` regardless of actual
                // platform activity. Computed instead from real
                // onboardedPlayers signup timestamps: growth over the
                // trailing 30 days vs. the 30 days before that, excluding
                // placeholder seed accounts.
                const playersSnap = await getDocs(collection(db, 'onboardedPlayers'));
                const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
                let recentCount = 0;
                let priorCount = 0;
                for (const doc of playersSnap.docs) {
                    const data = doc.data();
                    if (isPlaceholderPlayer(data)) continue;
                    const onboardedAt = data.onboardedAt ? new Date(data.onboardedAt) : null;
                    if (!onboardedAt || isNaN(onboardedAt.getTime())) continue;
                    if (onboardedAt > oneMonthAgo) recentCount++;
                    else if (onboardedAt > sixtyDaysAgo) priorCount++;
                }
                const userGrowth = priorCount > 0
                    ? Math.round(((recentCount - priorCount) / priorCount) * 100)
                    : (recentCount > 0 ? 100 : 0);

                if (mounted) {
                    setStats(prev => ({
                        ...prev,
                        activeClubs: clubs.size,
                        monthlyTournaments: monthlyT,
                        userGrowth
                    }));
                }
            } catch (e) {
                console.error("Error fetching stats", e);
            }
        };

        fetchStats();

        return () => {
            mounted = false;
            unsubPlayers();
            unsubMatches();
            unsubTournaments();
        };
    }, []);
    
    return stats;
};

export const AnimatedCounter: React.FC<{ value: number; prefix?: string; suffix?: string; format?: boolean }> = ({ value, prefix = '', suffix = '', format = false }) => {
    const [count, setCount] = useState(0);
    const [animated, setAnimated] = useState(false);
    const ref = useRef<HTMLElement>(null);
    
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !animated) {
                setAnimated(true);
            }
        }, { threshold: 0.22 });
        
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [animated]);

    useEffect(() => {
        if (!animated) return;
        let startTime: number | null = null;
        const duration = 1250;
        let rafId: number;

        const tick = (now: number) => {
            if (!startTime) startTime = now;
            const p = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setCount(Math.round(value * eased));
            if (p < 1) {
                rafId = requestAnimationFrame(tick);
            } else {
                setCount(value);
            }
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [animated, value]);

    const displayValue = format ? count.toLocaleString() : (value >= 1000 ? (count / 1000).toFixed(1) + 'K' : count);
    
    return <strong ref={ref}>{prefix}{displayValue}{suffix}</strong>;
};
