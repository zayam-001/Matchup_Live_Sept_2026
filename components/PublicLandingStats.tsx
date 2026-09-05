import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, onSnapshot, collectionGroup } from 'firebase/firestore';
import { db } from '../services/storage';

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

        let activePlayerCount = 0;
        let totalMatches = 0;
        let liveMatches = 0;
        let tournamentsHosted = 0;
        
        const unsubPlayers = onSnapshot(collection(db, 'onboardedPlayers'), (snap) => {
            activePlayerCount = snap.size;
            if (mounted) {
                setStats(prev => ({ ...prev, activePlayers: activePlayerCount }));
            }
        });

        const unsubMatches = onSnapshot(collectionGroup(db, 'matches'), (snap) => {
            totalMatches = snap.size;
            liveMatches = snap.docs.filter(m => {
                const data = m.data();
                return data.status === 'IN_PROGRESS' || data.status === 'live';
            }).length;
            if (mounted) {
                setStats(prev => ({ ...prev, totalMatchesPlayed: totalMatches, matchesLive: liveMatches }));
            }
        });

        const unsubTournaments = onSnapshot(collection(db, 'tournaments'), (snap) => {
            tournamentsHosted = snap.size;
            if (mounted) {
                setStats(prev => ({ ...prev, tournamentsHosted }));
            }
        });

        const fetchStats = async () => {
            try {
                const teamsSnap = await getDocs(collection(db, 'teams'));
                
                let clubs = new Set();
                let monthlyT = 0;
                
                const now = new Date();
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(now.getMonth() - 1);
                
                const tSnap = await getDocs(collection(db, 'tournaments'));
                for (const doc of tSnap.docs) {
                    const data = doc.data();
                    if (data.venue) clubs.add(data.venue);
                    if (data.createdAt) {
                        const cDate = new Date(data.createdAt);
                        if (cDate > oneMonthAgo) monthlyT++;
                    } else {
                        monthlyT++; // assume recent if no date
                    }
                }
                
                if (mounted) {
                    setStats(prev => ({
                        ...prev,
                        activeClubs: clubs.size,
                        monthlyTournaments: monthlyT,
                        userGrowth: 38 // static or calc from historical data
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
