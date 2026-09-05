import React, { useState, useRef, useEffect } from 'react';
import { subscribeToTournaments, subscribeToTournament, registerTeam, getPlayerSquads, uploadSystemImage } from '../services/storage';
import { Tournament, Sponsor, SponsorTier, Squad } from '../types';
import { User, Phone, Mail, Users, CheckCircle, Camera, ChevronRight, MapPin, AlertCircle, Plus, Search, Calendar, Trophy } from 'lucide-react';
import { Card } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { useAuth } from '../hooks/useAuth';

export const RegistrationForm: React.FC<{ initialTournamentId?: string }> = ({ initialTournamentId }) => {
  const { user: currentPlayer, loading: authLoading } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(null);
  const [isRegisteringForSomeoneElse, setIsRegisteringForSomeoneElse] = useState(false);

  const [formData, setFormData] = useState({
    teamName: '',
    p1Name: '', p1Phone: '', p1Email: '', p1Photo: '', p1Cnic: '',
    p2Name: '', p2Phone: '', p2Email: '', p2Photo: '', p2Cnic: ''
  });

  const p1FileInputRef = useRef<HTMLInputElement>(null);
  const p2FileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentPlayer && !isRegisteringForSomeoneElse) {
        setSquads(getPlayerSquads(currentPlayer.id));
        setFormData(prev => ({
            ...prev,
            p1Name: currentPlayer.fullName || currentPlayer.name || '',
            p1Phone: currentPlayer.phone || '',
            p1Email: currentPlayer.email || '',
            p1Photo: currentPlayer.photoUrl || ''
        }));
        
        const pendingTournamentId = sessionStorage.getItem('postAuthTournamentId');
        const finalTournamentId = initialTournamentId || pendingTournamentId;
        if (finalTournamentId) {
            setSelectedTournamentId(finalTournamentId);
            sessionStorage.removeItem('postAuthTournamentId');
        }
    } else if (isRegisteringForSomeoneElse) {
        setFormData(prev => ({
            ...prev,
            p1Name: '',
            p1Phone: '',
            p1Email: '',
            p1Photo: ''
        }));
    }

    // Fetches the list (lightweight, no sponsors)
    const unsubscribe = subscribeToTournaments((data) => {
        setTournaments(data);
        if (initialTournamentId) {
            setSelectedTournamentId(initialTournamentId);
        }
    });
    return () => unsubscribe();
  }, [currentPlayer, isRegisteringForSomeoneElse, initialTournamentId]);

  const handleSelectSquad = (squad: Squad) => {
      setSelectedSquadId(squad.id);
      setFormData(prev => ({
          ...prev,
          teamName: squad.name,
          p2Name: squad.partner.name,
          p2Phone: squad.partner.phone,
          p2Email: squad.partner.email,
          p2Photo: squad.partner.photoUrl || ''
      }));
  };

  const handleClearSquad = () => {
      setSelectedSquadId(null);
      setFormData(prev => ({
          ...prev,
          teamName: '',
          p2Name: '',
          p2Phone: '',
          p2Email: '',
          p2Photo: ''
      }));
  };

  useEffect(() => {
    // When ID selected, fetch full details including sponsors subcollection
    if (selectedTournamentId) {
        // Resolve slug if needed
        let resolvedId = selectedTournamentId;
        if (tournaments.length > 0) {
            const t = tournaments.find(x => x.id === selectedTournamentId || (x.slug && x.slug === selectedTournamentId) || x.name === selectedTournamentId);
            if (t) resolvedId = t.id;
        }

        const unsubscribe = subscribeToTournament(resolvedId, (data) => setSelectedTournament(data));
        return () => unsubscribe();
    } else {
        setSelectedTournament(null);
    }
  }, [selectedTournamentId, tournaments]);

  // Helper to compress and convert image to base64
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, player: 'p1' | 'p2') => {
    if (e.target.files && e.target.files[0]) {
        try {
            const url = await uploadSystemImage('registrationPhotos', e.target.files[0]);
            if (player === 'p1') setFormData(prev => ({ ...prev, p1Photo: url }));
            else setFormData(prev => ({ ...prev, p2Photo: url }));
        } catch (error) {
            console.error("Upload error:", error);
            alert("Failed to upload image.");
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament) return;
    setLoading(true);
    
    const currentCategory = selectedTournament.categories?.find(c => c.id === selectedCategoryId);
    const isAmericanoMode = selectedTournament.format === 'AMERICANO' || 
                           selectedTournament.format === 'MEXICANO' || 
                           currentCategory?.format === 'AMERICANO' || 
                           currentCategory?.format === 'MEXICANO';
    
    try {
        await registerTeam(selectedTournament.id, {
            name: isAmericanoMode ? formData.p1Name : formData.teamName,
            categoryId: selectedCategoryId || undefined,
            registeredBy: isRegisteringForSomeoneElse ? currentPlayer?.id : undefined,
            player1: { 
                id: isRegisteringForSomeoneElse ? undefined : currentPlayer?.id,
                name: formData.p1Name, 
                phone: formData.p1Phone, 
                email: formData.p1Email,
                cnic: formData.p1Cnic, 
                verified: !isRegisteringForSomeoneElse && !!currentPlayer,
                photoUrl: formData.p1Photo 
            },
            player2: isAmericanoMode ? { name: 'N/A', phone: '0', email: 'none@none', verified: false } : { 
                name: formData.p2Name, 
                phone: formData.p2Phone, 
                email: formData.p2Email, 
                cnic: formData.p2Cnic,
                verified: false,
                photoUrl: formData.p2Photo
            }
        });
        setSubmitted(true);
    } catch (err) {
        alert("Error registering team.");
        console.error(err);
    }
    setLoading(false);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('All Cities');
  const [selectedSport, setSelectedSport] = useState('All Sports');

  // Extract unique cities and sports for filters
  const cities = ['All Cities', ...Array.from(new Set(tournaments.map(t => t.city || 'Karachi')))];
  const sports = ['All Sports', ...Array.from(new Set(tournaments.map(t => t.sport || 'Padel')))];

  const filteredTournaments = tournaments.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (t.venue || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCity = selectedCity === 'All Cities' || (t.city || 'Karachi') === selectedCity;
      const matchesSport = selectedSport === 'All Sports' || (t.sport || 'Padel') === selectedSport;
      return matchesSearch && matchesCity && matchesSport;
  });

  if (!selectedTournamentId || !selectedTournament) {
      return (
          <div className="pb-20 w-full max-w-4xl mx-auto px-4 pt-28 md:pt-36">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div className="text-center md:text-left">
                      <h1 className="text-2xl md:text-3xl mb-0">Discover Events</h1>
                      <p className="text-content-secondary mt-1 text-sm md:text-base">Find and register for upcoming tournaments.</p>
                  </div>
              </div>

              {/* Filters */}
              <div className="bg-surface-panel border border-white/5 rounded-2xl p-4 mb-8 flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={18} />
                      <input 
                          type="text" 
                          placeholder="Search tournaments or venues..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-surface-ground border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand transition-colors"
                      />
                  </div>
                  <div className="grid grid-cols-2 sm:flex gap-4">
                      <div className="relative">
                          <select 
                              value={selectedCity}
                              onChange={(e) => setSelectedCity(e.target.value)}
                              className="w-full bg-surface-ground border border-white/10 rounded-xl py-3 pl-4 pr-8 text-white focus:outline-none focus:border-brand transition-colors appearance-none min-w-0 sm:min-w-[140px]"
                          >
                              {cities.map(city => <option key={city} value={city}>{city}</option>)}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-content-muted">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </div>
                      </div>
                      <div className="relative">
                          <select 
                              value={selectedSport}
                              onChange={(e) => setSelectedSport(e.target.value)}
                              className="w-full bg-surface-ground border border-white/10 rounded-xl py-3 pl-4 pr-8 text-white focus:outline-none focus:border-brand transition-colors appearance-none min-w-0 sm:min-w-[140px]"
                          >
                              {sports.map(sport => <option key={sport} value={sport}>{sport}</option>)}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-content-muted">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </div>
                      </div>
                  </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTournaments.length === 0 && (
                      <div className="col-span-full text-center py-12 bg-surface-panel border border-dashed border-white/10 rounded-2xl">
                          <p className="text-content-muted">No tournaments found matching your criteria.</p>
                      </div>
                  )}
                  {filteredTournaments.map(t => (
                      <Card 
                        key={t.id} 
                        variant="panel"
                        onClick={() => {
                          const targetId = t.slug || t.id;
                          if (!currentPlayer) {
                            sessionStorage.setItem('postAuthRedirect', `register/${targetId}`);
                            sessionStorage.setItem('postAuthTournamentId', targetId);
                            window.location.hash = 'auth';
                          } else {
                            window.location.hash = `register/${targetId}`;
                          }
                        }}
                        className="p-0 flex flex-col group transition-all cursor-pointer hover:border-brand/50 overflow-hidden"
                      >
                          {t.bannerUrl && (
                              <div className="w-full h-32 overflow-hidden relative border-b border-white/5">
                                  <img src={t.bannerUrl} alt="Tournament Banner" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              </div>
                          )}
                          <div className="p-6 flex-1">
                              <div className="flex items-start justify-between gap-4 mb-4">
                                  <div>
                                      <div className="flex items-center gap-2 mb-2">
                                          <Badge variant="neutral" className="text-[10px]">{t.sport || 'Padel'}</Badge>
                                          <Badge variant="neutral" className="text-[10px]">{t.skillLevel}</Badge>
                                      </div>
                                      <div className="font-black text-xl text-white group-hover:text-brand transition-colors leading-tight">{t.name}</div>
                                  </div>
                              </div>
                              
                              <div className="space-y-2 mb-6">
                                  <div className="flex items-center gap-2 text-sm text-content-secondary">
                                      <MapPin size={14} className="text-brand" />
                                      <span>{t.venue || "Venue TBD"} • {t.city || 'Karachi'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-content-secondary">
                                      <Calendar size={14} className="text-brand" />
                                      <span>Deadline: {new Date(t.registrationDeadline).toLocaleDateString()}</span>
                                  </div>
                              </div>
                          </div>
                          
            <div className="bg-surface-ground border-t border-white/5 p-4 flex items-center justify-between">
              <div className="text-sm">
                  {t.isMultiCategory ? (
                      <span className="text-brand font-bold">{t.categories?.length || 0} Categories</span>
                  ) : (
                      <>
                          <span className="text-content-muted">Entry Fee: </span>
                          <span className="text-white font-bold">{t.currency || 'PKR'} {t.entryFee}</span>
                      </>
                  )}
              </div>
              <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center group-hover:bg-brand group-hover:text-content-inverse transition-colors">
                  <ChevronRight size={16} />
              </div>
            </div>
                      </Card>
                  ))}
              </div>
          </div>
      )
  }

  if (submitted) {
    return (
        <div className="max-w-md mx-auto mt-10 text-center p-8 bg-surface-panel rounded-2xl border border-accent-success/50">
            <div className="w-16 h-16 bg-accent-success/20 text-accent-success rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Registration Received!</h2>
            <p className="text-content-secondary">
                Team <span className="text-brand">{formData.teamName}</span> has been submitted for approval. 
            </p>
            <button 
                onClick={() => { setSubmitted(false); setSelectedTournamentId(null); setSelectedTournament(null); setFormData({ teamName: '', p1Name: '', p1Phone: '', p1Email: '', p1Photo: '', p1Cnic: '', p2Name: '', p2Phone: '', p2Email: '', p2Photo: '', p2Cnic: '' })}}
                className="mt-8 text-sm text-content-muted hover:text-white underline"
            >
                Back to Tournaments
            </button>
        </div>
    )
  }

  const sponsors = selectedTournament?.sponsors || [];
  const platinumSponsors = sponsors.filter(s => typeof s !== 'string' && s.tier === SponsorTier.PLATINUM);
  const goldSponsors = sponsors.filter(s => typeof s !== 'string' && s.tier === SponsorTier.GOLD);
  const silverSponsors = sponsors.filter(s => typeof s !== 'string' && s.tier === SponsorTier.SILVER);
  const legacySponsors = sponsors.filter(s => typeof s === 'string' || !s.tier); 

  // Handle Legacy Sponsors vs New Sponsors
  const titleSponsor = selectedTournament.sponsors?.find((s: any) => typeof s !== 'string' && s.tier === SponsorTier.TITLE);
  
  const currentCategory = selectedTournament.categories?.find(c => c.id === selectedCategoryId);
  const isAmericanoMode = selectedTournament?.format === 'AMERICANO' || 
                         selectedTournament?.format === 'MEXICANO' || 
                         currentCategory?.format === 'AMERICANO' || 
                         currentCategory?.format === 'MEXICANO';
                         
  const displayBanner = currentCategory?.bannerUrl || selectedTournament.bannerUrl;
  const displayFee = currentCategory?.entryFee ?? selectedTournament.entryFee;
  const displayPrize = currentCategory?.prizeMoney ?? selectedTournament.prizeMoney;
  const displayVenue = (currentCategory as any)?.venue || selectedTournament.venue;

  const currentAcceptedCount = (selectedTournament.teams || []).filter(t => t.status === 'ACCEPTED' && (!currentCategory || t.categoryId === currentCategory.id)).length;
  const currentMaxTeams = currentCategory ? currentCategory.maxTeams : selectedTournament.maxTeams;
  const isCurrentlyFull = currentMaxTeams ? currentAcceptedCount >= currentMaxTeams : false;

  if (selectedTournament.isMultiCategory && !selectedCategoryId) {
      return (
          <div className="max-w-2xl mx-auto pb-20 px-4 pt-28 md:pt-36">
              <button onClick={() => { setSelectedTournamentId(null); setSelectedTournament(null); }} className="text-content-muted hover:text-white mb-6 flex items-center gap-1">
                  &larr; Choose Different Tournament
              </button>

              <div className="text-center mb-10">
                  <h1 className="text-2xl md:text-3xl mb-0 px-4">{selectedTournament.name}</h1>
                  <p className="text-content-secondary mt-2 text-sm md:text-base">Select a category to register</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
                  {selectedTournament.categories?.map(cat => {
                      const acceptedCount = (selectedTournament.teams || []).filter(t => t.categoryId === cat.id && t.status === 'ACCEPTED').length;
                      const isFull = cat.maxTeams ? acceptedCount >= cat.maxTeams : false;

                      return (
                      <Card 
                        key={cat.id} 
                        variant="panel" 
                        onClick={() => !isFull && setSelectedCategoryId(cat.id)}
                        className={`p-0 overflow-hidden transition-all ${isFull ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer group hover:border-brand/40'}`}
                      >
                          <div className="flex flex-col sm:flex-row min-h-[160px]">
                              {cat.bannerUrl && (
                                  <div className="w-full sm:w-40 md:w-56 h-40 sm:h-auto flex-shrink-0 border-b sm:border-b-0 sm:border-r border-white/5">
                                      <img src={cat.bannerUrl} className="w-full h-full object-cover" />
                                  </div>
                              )}
                              <div className="flex-1 p-5 md:p-6 flex flex-col justify-between">
                                  <div>
                                      <div className="flex items-center flex-wrap gap-2 mb-2">
                                          <Badge variant="neutral" className="text-[10px] uppercase font-bold">{cat.skillLevel}</Badge>
                                          {cat.maxTeams && <span className="text-[10px] text-content-muted">{acceptedCount} / {cat.maxTeams} Teams</span>}
                                          {isFull && <Badge variant="warning" className="text-[10px] ml-auto">FULL</Badge>}
                                      </div>
                                      <h3 className="text-xl md:text-2xl font-black text-white group-hover:text-brand transition-colors uppercase italic">{cat.name}</h3>
                                  </div>
                                  <div className="flex items-center justify-between mt-6">
                                      <div>
                                          <div className="text-[10px] text-content-muted uppercase font-bold">Entry Fee</div>
                                          <div className="text-white font-bold">{selectedTournament.currency || 'PKR'} {cat.entryFee}</div>
                                      </div>
                                      {!isFull ? (
                                        <div className="px-4 py-2 bg-brand/10 text-brand text-xs font-bold rounded-lg group-hover:bg-brand group-hover:text-content-inverse transition-all">
                                            Register Now
                                        </div>
                                      ) : (
                                        <div className="px-4 py-2 bg-surface-header text-content-muted text-xs font-bold rounded-lg border border-white/5">
                                            Sold Out
                                        </div>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </Card>
                      );
                  })}
              </div>
          </div>
      )
  }

  return (
    <div className="w-full max-w-2xl mx-auto pb-20 px-4 pt-28 md:pt-36">
      <button onClick={() => { 
          if (selectedTournament.isMultiCategory) {
              setSelectedCategoryId(null);
          } else {
              setSelectedTournamentId(null); 
              setSelectedTournament(null); 
          }
      }} className="text-content-muted hover:text-white mb-6 flex items-center gap-1">
          &larr; {selectedTournament.isMultiCategory ? 'Back to Categories' : 'Choose Different Tournament'}
      </button>

      {displayBanner && (
          <div className="w-full h-48 md:h-64 rounded-2xl overflow-hidden relative border border-white/10 shadow-lg mb-8">
              <img src={displayBanner} alt="Tournament Banner" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center p-6 pb-8">
                  <div className="text-center">
                      {selectedTournament.isMultiCategory && currentCategory && (
                          <Badge variant="brand" className="mb-2">{currentCategory.name}</Badge>
                      )}
                      <h1 className="text-2xl font-bold text-white shadow-sm">{selectedTournament.name}</h1>
                  </div>
              </div>
          </div>
      )}

      <div className="text-center mb-8 md:mb-10 px-4">
        {!displayBanner && (
            <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase mb-2">Join {selectedTournament.name}</h1>
        )}
        
        {titleSponsor && (
             <div className="flex justify-center my-6">
                 <img src={titleSponsor.logo} alt="Title Sponsor" className="h-20 md:h-24 object-contain" />
             </div>
        )}

        <div className="flex flex-col items-center gap-2">
             <div className="inline-flex items-center gap-1.5 text-brand font-bold uppercase text-xs md:text-sm mb-1 px-4 py-1.5 bg-brand/5 border border-brand/20 rounded-full">
                 <MapPin size={14} /> {displayVenue || "Venue TBD"}
             </div>
             <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-sm md:text-base">
                <span className="text-white font-bold">Entry: {selectedTournament.currency || 'PKR'} {displayFee}</span>
                <span className="hidden md:inline text-white/20">•</span>
                <span className="text-content-secondary">{currentCategory?.format?.replace(/_/g, ' ') || selectedTournament.format.replace(/_/g, ' ')}</span>
             </div>
             {displayPrize && (
                 <div className="flex items-center gap-2 text-accent-success font-black text-sm md:text-base mt-2 px-4 py-2 bg-accent-success/5 rounded-xl border border-accent-success/20">
                     <Trophy size={16} />
                     <span>PRIZE POOL: {selectedTournament.currency || 'PKR'} {displayPrize}</span>
                 </div>
             )}
             {selectedTournament.organizer && <p className="text-content-muted text-[10px] uppercase tracking-widest mt-4">Organized by {selectedTournament.organizer}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
        
        {/* Squad Selection (If logged in and has squads) */}
        {currentPlayer && squads.length > 0 && (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-content-muted">Fast Registration</h3>
                    {selectedSquadId && (
                        <button type="button" onClick={handleClearSquad} className="text-xs text-brand hover:text-brand-light font-bold">
                            Clear Selection
                        </button>
                    )}
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                    {squads.map(squad => (
                        <div 
                            key={squad.id}
                            onClick={() => handleSelectSquad(squad)}
                            className={`flex-shrink-0 w-64 p-4 rounded-2xl border cursor-pointer transition-all ${selectedSquadId === squad.id ? 'bg-brand/10 border-brand shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-surface-panel border-white/5 hover:border-white/20'}`}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex -space-x-3">
                                    <Avatar fallback={currentPlayer.name} src={currentPlayer.photoUrl} size="sm" className="border-2 border-surface-panel relative z-10" />
                                    <Avatar fallback={squad.partner.name} src={squad.partner.photoUrl} size="sm" className="border-2 border-surface-panel" />
                                </div>
                                <div className="text-sm font-bold text-white truncate">{squad.name}</div>
                            </div>
                            <div className="text-xs text-content-muted truncate">with {squad.partner.name}</div>
                        </div>
                    ))}
                    <div 
                        onClick={handleClearSquad}
                        className={`flex-shrink-0 w-64 p-4 rounded-2xl border border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${!selectedSquadId ? 'bg-white/5 border-white/20' : 'bg-transparent border-white/10 hover:bg-white/5'}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-content-muted">
                            <Plus size={16} />
                        </div>
                        <div className="text-sm font-bold text-white">New One-Time Team</div>
                    </div>
                </div>
            </div>
        )}

        {/* Team Info */}
        {!isAmericanoMode && (
            <Card variant="panel" className="p-4 md:p-6">
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Users className="text-brand" size={20} /> Team Details
              </h3>
              <div>
                <label className="block text-sm text-content-secondary mb-2">Team Name</label>
                <input 
                  required
                  value={formData.teamName}
                  onChange={e => setFormData({...formData, teamName: e.target.value})}
                  disabled={!!selectedSquadId}
                  className="w-full bg-surface-ground border border-white/10 rounded-lg p-3 text-white focus:border-brand focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="e.g. The Match Up Pros"
                />
              </div>
            </Card>
        )}

        <div className={`grid grid-cols-1 ${isAmericanoMode ? '' : 'md:grid-cols-2'} gap-6`}>
            {/* Player 1 */}
            <Card variant="panel" className="p-4 md:p-6 relative overflow-hidden">
                {currentPlayer && (
                    <div className="absolute top-0 right-0 bg-brand/20 text-brand text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl border-b border-l border-brand/20">
                        Your Profile
                    </div>
                )}
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                        <User className="text-brand" size={20} /> Player 1
                    </h3>
                    <div 
                        onClick={() => (!currentPlayer || isRegisteringForSomeoneElse) && p1FileInputRef.current?.click()}
                        className={`w-12 h-12 rounded-full bg-surface-ground border border-dashed border-white/20 flex items-center justify-center overflow-hidden ${(!currentPlayer || isRegisteringForSomeoneElse) ? 'cursor-pointer hover:border-brand' : 'opacity-80'}`}
                    >
                        {formData.p1Photo ? (
                            <img src={formData.p1Photo} alt="P1" className="w-full h-full object-cover" />
                        ) : (
                            <Camera size={16} className="text-content-muted" />
                        )}
                        {(!currentPlayer || isRegisteringForSomeoneElse) && (
                            <input 
                                type="file" 
                                ref={p1FileInputRef} 
                                onChange={(e) => handleImageChange(e, 'p1')} 
                                className="hidden" 
                                accept="image/*"
                            />
                        )}
                    </div>
                </div>
                {currentPlayer && (
                    <div className="mb-4 flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="registerOther" 
                            checked={isRegisteringForSomeoneElse}
                            onChange={(e) => setIsRegisteringForSomeoneElse(e.target.checked)}
                            className="bg-surface-ground border-white/20 rounded accent-brand w-4 h-4"
                        />
                        <label htmlFor="registerOther" className="text-sm text-content-secondary cursor-pointer">
                            I am registering for someone else
                        </label>
                    </div>
                )}
                <div className="space-y-4">
                    {currentPlayer && !isRegisteringForSomeoneElse ? (
                        <div className="space-y-4 opacity-80 pointer-events-none">
                            <Input required label="Full Name" value={formData.p1Name} onChange={() => {}} icon={<User size={16}/>} />
                            <Input required label="Phone" value={formData.p1Phone} onChange={() => {}} icon={<Phone size={16}/>} />
                            <Input required label="Email" value={formData.p1Email} onChange={() => {}} icon={<Mail size={16}/>} type="email" />
                            <Input label="CNIC (Optional)" value={formData.p1Cnic} onChange={() => {}} />
                        </div>
                    ) : (
                        <>
                            <Input required label="Full Name" value={formData.p1Name} onChange={(v: string) => setFormData({...formData, p1Name: v})} icon={<User size={16}/>} />
                            <Input required label="Phone" value={formData.p1Phone} onChange={(v: string) => setFormData({...formData, p1Phone: v})} icon={<Phone size={16}/>} />
                            <Input required label="Email" value={formData.p1Email} onChange={(v: string) => setFormData({...formData, p1Email: v})} icon={<Mail size={16}/>} type="email" />
                            <Input label="CNIC (Optional)" value={formData.p1Cnic} onChange={(v: string) => setFormData({...formData, p1Cnic: v})} placeholder="XXXXX-XXXXXXX-X" />
                        </>
                    )}
                </div>
            </Card>

            {/* Player 2 */}
            {!isAmericanoMode && (
                <Card variant="panel" className={`p-4 md:p-6 relative overflow-hidden transition-all ${selectedSquadId ? 'border-brand/50 bg-brand/5' : ''}`}>
                    {selectedSquadId && (
                        <div className="absolute top-0 right-0 bg-brand/20 text-brand text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl border-b border-l border-brand/20">
                            Squad Partner
                        </div>
                    )}
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            <User className="text-brand" size={20} /> Player 2
                        </h3>
                        <div 
                            onClick={() => !selectedSquadId && p2FileInputRef.current?.click()}
                            className={`w-12 h-12 rounded-full bg-surface-ground border border-dashed border-white/20 flex items-center justify-center overflow-hidden ${!selectedSquadId ? 'cursor-pointer hover:border-brand' : 'opacity-80'}`}
                        >
                            {formData.p2Photo ? (
                                <img src={formData.p2Photo} alt="P2" className="w-full h-full object-cover" />
                            ) : (
                                <Camera size={16} className="text-content-muted" />
                            )}
                            {!selectedSquadId && (
                                <input 
                                    type="file" 
                                    ref={p2FileInputRef} 
                                    onChange={(e) => handleImageChange(e, 'p2')} 
                                    className="hidden" 
                                    accept="image/*"
                                />
                            )}
                        </div>
                    </div>
                    <div className="space-y-4">
                        {selectedSquadId ? (
                            <div className="space-y-4 opacity-80 pointer-events-none">
                                <Input required label="Full Name" value={formData.p2Name} onChange={() => {}} icon={<User size={16}/>} />
                                <Input required label="Phone" value={formData.p2Phone} onChange={() => {}} icon={<Phone size={16}/>} />
                                <Input required label="Email" value={formData.p2Email} onChange={() => {}} icon={<Mail size={16}/>} type="email" />
                                <Input label="CNIC (Optional)" value={formData.p2Cnic} onChange={() => {}} />
                            </div>
                        ) : (
                            <>
                                <Input required label="Full Name" value={formData.p2Name} onChange={(v: string) => setFormData({...formData, p2Name: v})} icon={<User size={16}/>} />
                                <Input required label="Phone" value={formData.p2Phone} onChange={(v: string) => setFormData({...formData, p2Phone: v})} icon={<Phone size={16}/>} />
                                <Input required label="Email" value={formData.p2Email} onChange={(v: string) => setFormData({...formData, p2Email: v})} icon={<Mail size={16}/>} type="email" />
                                <Input label="CNIC (Optional)" value={formData.p2Cnic} onChange={(v: string) => setFormData({...formData, p2Cnic: v})} placeholder="XXXXX-XXXXXXX-X" />
                            </>
                        )}
                    </div>
                </Card>
            )}
        </div>
        
        {isCurrentlyFull && (
            <div className="bg-accent-error/20 border border-accent-error text-accent-error rounded-xl p-4 flex items-center justify-center gap-2">
                <AlertCircle size={18} />
                <span className="font-bold">Teams Full! Registration is closed for this tournament.</span>
            </div>
        )}

        <button 
          disabled={loading || isCurrentlyFull}
          className="w-full bg-brand hover:bg-brand-light text-content-inverse font-bold py-4 rounded-xl transition-all shadow-lg shadow-brand/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : isCurrentlyFull ? 'Sold Out' : 'Submit Registration'}
        </button>

        {/* Sponsor Footer Grid */}
        {(platinumSponsors.length > 0 || goldSponsors.length > 0 || silverSponsors.length > 0 || legacySponsors.length > 0) && (
            <div className="mt-12 border-t border-white/10 pt-8">
                <h4 className="text-center text-content-muted text-xs uppercase tracking-widest mb-6">Our Partners</h4>
                
                {/* Platinum - Large */}
                {platinumSponsors.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-8 mb-8 items-center">
                        {platinumSponsors.map((s: any, i: number) => (
                            <img key={i} src={s.logo} className="h-16 md:h-20 object-contain opacity-90 hover:opacity-100 transition-opacity" />
                        ))}
                    </div>
                )}

                {/* Gold - Medium */}
                {goldSponsors.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-6 mb-6 items-center">
                        {goldSponsors.map((s: any, i: number) => (
                            <img key={i} src={s.logo} className="h-12 md:h-14 object-contain opacity-80 hover:opacity-100 transition-opacity" />
                        ))}
                    </div>
                )}

                {/* Silver - Small */}
                {(silverSponsors.length > 0 || legacySponsors.length > 0) && (
                    <div className="flex flex-wrap justify-center gap-4 items-center">
                        {silverSponsors.map((s: any, i: number) => (
                            <img key={i} src={s.logo} className="h-8 md:h-10 object-contain opacity-60 hover:opacity-100 transition-opacity" />
                        ))}
                        {legacySponsors.map((s: any, i: number) => (
                             <img key={`l-${i}`} src={typeof s === 'string' ? s : s.logo} className="h-8 md:h-10 object-contain opacity-60 hover:opacity-100 transition-opacity" />
                        ))}
                    </div>
                )}
            </div>
        )}
      </form>
    </div>
  );
};

// Simple Input Component
const Input = ({ label, value, onChange, icon, type = "text", required = false }: any) => (
  <div>
    <label className="block text-xs font-medium text-content-secondary mb-1 uppercase tracking-wider">{label} {required && '*'}</label>
    <div className="relative">
      <input 
        required={required}
        type={type}
        className="w-full bg-surface-ground border border-white/10 rounded-xl py-4 pl-11 pr-4 text-white text-base md:text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-all appearance-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-content-muted">
        {icon}
      </div>
    </div>
  </div>
);
