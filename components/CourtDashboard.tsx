import React, { useState, useEffect, useMemo } from 'react';
import { getCourtByToken, getVenueById, subscribeToVenueQuickplayStats } from '../services/storage';
import { Activity, Users, TrendingUp, Loader2, AlertTriangle, MessageSquare } from 'lucide-react';
import { Logo } from './ui/Logo';

export const CourtDashboard: React.FC = () => {
  const [court, setCourt] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<'overview' | 'change_requests'>('overview');
  const [changeRequests, setChangeRequests] = useState<any[]>([]);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const courtId = hashParams.get('court');
    const token = hashParams.get('token');

    if (!courtId || !token) {
      setError('Invalid dashboard URL.');
      setLoading(false);
      return;
    }

    let unsubSessions = () => {};
    let unsubRequests = () => {};

    const fetchData = async () => {
      try {
        const courtData = await getCourtByToken(token, 'admin');
        if (!courtData || courtData.id !== courtId) {
          setError('Dashboard not available.');
          setLoading(false);
          return;
        }
        setCourt(courtData);

        if (courtData && 'venueId' in courtData && courtData.venueId) {
          const venueData = await getVenueById(courtData.venueId as string) as any;
          setVenue(venueData);

          unsubSessions = subscribeToVenueQuickplayStats(venueData?.name || '', (data) => {
            setSessions(data);
            setLoading(false);
          });
          
          // Also fetch change requests for this venue
          const { subscribeToScoreChangeRequests } = await import('../services/storage');
          unsubRequests = subscribeToScoreChangeRequests(venueData?.id || '', (data: any) => {
              setChangeRequests(data);
          });
        } else {
          setLoading(false);
        }

      } catch (e) {
        setError('Failed to load dashboard.');
        setLoading(false);
      }
    };

    fetchData();
    return () => {
        unsubSessions();
        unsubRequests();
    };
  }, []);

  const stats = useMemo(() => {
    let todaysMatches = 0;
    let totalMatches = sessions.length;
    let uniquePlayers = new Set<string>();
    let feedbackCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    const today = new Date().toDateString();

    sessions.forEach(s => {
      if (new Date(s.createdAt).toDateString() === today) {
        todaysMatches++;
      }
      (s.players || []).forEach((p: any) => {
        if (p.id) uniquePlayers.add(p.id);
      });
      if (s.feedbackRating) {
        feedbackCounts[s.feedbackRating as keyof typeof feedbackCounts]++;
      }
    });

    const averageRating = (1*feedbackCounts[1] + 2*feedbackCounts[2] + 3*feedbackCounts[3] + 4*feedbackCounts[4] + 5*feedbackCounts[5]) / (totalMatches || 1);

    return {
      todaysMatches,
      totalMatches,
      uniquePlayers: uniquePlayers.size,
      averageRating,
      feedbacks: sessions.filter(s => s.feedbackRating).slice(0, 10).map(s => ({ rating: s.feedbackRating, type: s.type, date: s.createdAt }))
    };
  }, [sessions]);

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6 pt-28 md:pt-36 pb-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">{venue?.name || court?.courtName}</h1>
            <p className="text-green-400 font-medium">Court Dashboard</p>
          </div>
          <Logo className="w-12 h-12" />
        </div>

        {/* Navigation Panel */}
        <div className="flex bg-gray-800 p-1 rounded-xl mb-8">
            <button 
                onClick={() => setActiveTab('overview')} 
                className={`flex-1 flex justify-center py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'overview' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
                Overview
            </button>
            <button 
                onClick={() => setActiveTab('change_requests')} 
                className={`flex-1 flex justify-center py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'change_requests' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
                Quick Play / Requests {changeRequests.length > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{changeRequests.length}</span>}
            </button>
        </div>

        {activeTab === 'overview' ? (
            <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-blue-500/20 p-3 rounded-lg text-blue-400">
                        <Activity className="w-6 h-6" />
                      </div>
                      <h3 className="text-gray-400 font-medium">Today's Sessions</h3>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.todaysMatches}</p>
                  </div>

                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-green-500/20 p-3 rounded-lg text-green-400">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <h3 className="text-gray-400 font-medium">Total Sessions</h3>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.totalMatches}</p>
                  </div>

                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-purple-500/20 p-3 rounded-lg text-purple-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <h3 className="text-gray-400 font-medium">Players Met</h3>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.uniquePlayers}</p>
                  </div>

                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-yellow-500/20 p-3 rounded-lg text-yellow-400">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <h3 className="text-gray-400 font-medium">Avg Rating</h3>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.averageRating ? stats.averageRating.toFixed(1) : '-'}/5</p>
                  </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
                    <h3 className="text-lg font-bold text-white mb-6">Recent Sessions & Feedback</h3>
                    <div className="space-y-4">
                      {stats.feedbacks.length === 0 ? (
                         <div className="text-content-secondary py-4 text-sm">No feedback received yet.</div>
                      ) : stats.feedbacks.map((f, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                          <div>
                            <div className="text-white font-medium mb-1 capitalize">{f.type} Match</div>
                            <div className="text-xs text-content-muted">{new Date(f.date).toLocaleString()}</div>
                          </div>
                          <div className="mt-2 sm:mt-0 flex items-center gap-2">
                            <span className="text-2xl">{[{l:1, e:'😡'}, {l:2, e:'😞'}, {l:3, e:'😐'}, {l:4, e:'🙂'}, {l:5, e:'🤩'}].find(x => x.l === f.rating)?.e || '⭐️'}</span>
                            <span className="text-gray-400 text-sm font-bold">{f.rating}/5</span>
                          </div>
                        </div>
                      ))}
                    </div>
                </div>
            </>
        ) : (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-bold text-white mb-6">Score Change Requests</h3>
                <div className="space-y-4">
                    {changeRequests.length === 0 ? (
                         <div className="text-content-secondary py-8 text-sm text-center">No pending change requests.</div>
                    ) : changeRequests.map(req => (
                        <div key={req.id} className="p-4 bg-gray-900 border border-brand/30 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div>
                                <div className="text-white font-bold mb-1">Match: {req.matchId}</div>
                                <div className="text-sm text-content-secondary mb-2 whitespace-pre-wrap">{req.reason}</div>
                                <div className="text-xs text-content-muted">{new Date(req.createdAt).toLocaleString()}</div>
                            </div>
                            {req.status === 'pending' ? (
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <button 
                                        onClick={async () => {
                                            const { updateDoc, doc } = await import('firebase/firestore');
                                            const { db } = await import('../services/storage');
                                            await updateDoc(doc(db as any, 'scoreChangeRequests', req.id), { status: 'rejected' });
                                        }}
                                        className="flex-1 md:flex-none border border-red-500/50 text-red-500 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                                    >
                                        Reject
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            const { updateDoc, doc } = await import('firebase/firestore');
                                            const { db } = await import('../services/storage');
                                            await updateDoc(doc(db as any, 'scoreChangeRequests', req.id), { status: 'approved' });
                                            alert("Request approved. Please ensure the score is manually corrected using a master PIN.");
                                        }}
                                        className="flex-1 md:flex-none bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                                    >
                                        Approve
                                    </button>
                                </div>
                            ) : (
                                <div className={`text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-full ${req.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {req.status}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
