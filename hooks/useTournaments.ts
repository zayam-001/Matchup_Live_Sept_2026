import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../services/storage';

export interface UpcomingTournament {
  id: string;
  slug?: string;
  name: string;
  date: string;
  endDate?: string | null;
  venue: string;
  status: string;
}

export const useTournaments = () => {
  const [upcomingTournaments, setUpcomingTournaments] = useState<UpcomingTournament[]>([]);
  const [completedTournaments, setCompletedTournaments] = useState<UpcomingTournament[]>([]);
  const [tournaments, setTournaments] = useState<UpcomingTournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoadingTournaments(false);
      return;
    }

    const q = query(
      collection(db, 'tournaments'),
      where('status', 'in', ['ACTIVE', 'COMPLETED'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTournaments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          slug: data.slug,
          name: data.name || 'Unnamed Tournament',
          date: data.startDate || data.registrationDeadline || data.createdAt || new Date().toISOString(),
          endDate: data.endDate || null,
          venue: data.venue || data.city || 'TBD',
          status: data.status || 'DRAFT'
        };
      });

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      const upcoming = allTournaments
        .filter(t => {
          if (t.status === 'COMPLETED') return false;
          if (t.status === 'ACTIVE' || t.status === 'PUBLISHED') {
            if (t.endDate) {
              return new Date(t.endDate) >= now;
            }
            return true;
          }
          return false;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
      const completed = allTournaments
        .filter(t => {
          if (t.status === 'COMPLETED') return true;
          if ((t.status === 'ACTIVE' || t.status === 'PUBLISHED') && t.endDate) {
            return new Date(t.endDate) < now;
          }
          return false;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setUpcomingTournaments(upcoming);
      setCompletedTournaments(completed);
      setTournaments(allTournaments);
      setLoadingTournaments(false);
    }, (error) => {
      console.error("Error fetching tournaments:", error);
      setLoadingTournaments(false);
    });

    return () => unsubscribe();
  }, []);

  return { upcomingTournaments, completedTournaments, tournaments, loadingTournaments };
};
