import React, { useState, useRef } from 'react';
import { Sheet } from './ui/Sheet';
import { uploadSystemImage } from '../services/storage';
import { Loader2 } from 'lucide-react';
import { Tournament, Team } from '../types';

export const ManualEnrollmentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  categoryId?: string | null;
  onEnroll: (team: Omit<Team, 'id' | 'status'>) => void;
}> = ({ isOpen, onClose, tournament, categoryId, onEnroll }) => {
  const [teamName, setTeamName] = useState('');
  const [p1Name, setP1Name] = useState('');
  const [p1Phone, setP1Phone] = useState('');
  const [p1Email, setP1Email] = useState('');
  const [p1Cnic, setP1Cnic] = useState('');
  const [p1Photo, setP1Photo] = useState('');
  const [p2Name, setP2Name] = useState('');
  const [p2Phone, setP2Phone] = useState('');
  const [p2Email, setP2Email] = useState('');
  const [p2Cnic, setP2Cnic] = useState('');
  const [p2Photo, setP2Photo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, setPhoto: (url: string) => void) => {
      if (e.target.files && e.target.files[0]) {
          try {
              const url = await uploadSystemImage('players', e.target.files[0]);
              setPhoto(url);
          } catch (err) {
              console.error(err);
              alert("Failed to upload photo");
          }
      }
  };

  const currentCategory = categoryId ? tournament?.categories?.find(c => c.id === categoryId) : null;
  const isAmericanoMode = tournament?.format === 'AMERICANO' || 
                         tournament?.format === 'MEXICANO' || 
                         currentCategory?.format === 'AMERICANO' || 
                         currentCategory?.format === 'MEXICANO';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const newTeam: Omit<Team, 'id' | 'status'> = {
      name: isAmericanoMode ? p1Name : teamName,
      player1: {
        name: p1Name,
        phone: p1Phone,
        email: p1Email,
        cnic: p1Cnic,
        photoUrl: p1Photo,
        verified: false
      },
      player2: isAmericanoMode ? { name: 'N/A', phone: '0', email: 'none@none', verified: false } : {
        name: p2Name,
        phone: p2Phone,
        email: p2Email,
        cnic: p2Cnic,
        photoUrl: p2Photo,
        verified: false
      },
      registeredAt: new Date().toISOString()
    };

    try {
        await onEnroll(newTeam);
        onClose();
    } catch (e) {
        console.error("Failed to enroll", e);
        alert(`Failed to enroll ${isAmericanoMode ? 'player' : 'team'}. Try again.`);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Sheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isAmericanoMode ? "Manual Player Enrollment" : "Manual Enrollment"} 
      description={isAmericanoMode ? "Manually enroll a player into the tournament." : "Manually enroll a team into the tournament."}
    >
        <form onSubmit={handleSubmit} className="space-y-4">
            {!isAmericanoMode && (
                <div>
                    <label className="block text-content-secondary text-sm mb-1 font-medium">Team Name</label>
                    <input required className="w-full bg-surface-ground p-3 rounded-xl text-white border border-white/10 outline-none" value={teamName} onChange={e => setTeamName(e.target.value)} />
                </div>
            )}

            <div className={isAmericanoMode ? "grid grid-cols-1" : "grid grid-cols-2 gap-4"}>
                <div className="space-y-3 bg-surface-panel p-4 rounded-xl border border-white/5">
                    <h4 className="font-bold text-white text-sm">{isAmericanoMode ? "Player Details" : "Player 1"}</h4>
                    <input autoComplete="off" required placeholder="Name" className="w-full bg-surface-ground p-2 rounded border border-white/10 text-white text-sm outline-none" value={p1Name} onChange={e => setP1Name(e.target.value)} />
                    <input autoComplete="off" required placeholder="Number" className="w-full bg-surface-ground p-2 rounded border border-white/10 text-white text-sm outline-none" value={p1Phone} onChange={e => setP1Phone(e.target.value)} />
                    <input autoComplete="off" required type="email" placeholder="Email" className="w-full bg-surface-ground p-2 rounded border border-white/10 text-white text-sm outline-none" value={p1Email} onChange={e => setP1Email(e.target.value)} />
                    <input autoComplete="off" placeholder="CNIC (Optional)" className="w-full bg-surface-ground p-2 rounded border border-white/10 text-white text-sm outline-none" value={p1Cnic} onChange={e => setP1Cnic(e.target.value)} />
                    <div 
                        onClick={() => fileInputRef1.current?.click()}
                        className="w-full h-20 border border-dashed border-white/20 rounded flex items-center justify-center text-xs text-content-muted cursor-pointer hover:bg-white/5 relative overflow-hidden"
                    >
                        {p1Photo ? <img src={p1Photo} className="w-full h-full object-cover" /> : "Upload Photo"}
                    </div>
                    <input type="file" ref={fileInputRef1} className="hidden" accept="image/*" onChange={(e) => handleUpload(e, setP1Photo)} />
                </div>

                {!isAmericanoMode && (
                    <div className="space-y-3 bg-surface-panel p-4 rounded-xl border border-white/5">
                        <h4 className="font-bold text-white text-sm">Player 2</h4>
                        <input autoComplete="off" required placeholder="Name" className="w-full bg-surface-ground p-2 rounded border border-white/10 text-white text-sm outline-none" value={p2Name} onChange={e => setP2Name(e.target.value)} />
                        <input autoComplete="off" required placeholder="Number" className="w-full bg-surface-ground p-2 rounded border border-white/10 text-white text-sm outline-none" value={p2Phone} onChange={e => setP2Phone(e.target.value)} />
                        <input autoComplete="off" required type="email" placeholder="Email" className="w-full bg-surface-ground p-2 rounded border border-white/10 text-white text-sm outline-none" value={p2Email} onChange={e => setP2Email(e.target.value)} />
                        <input autoComplete="off" placeholder="CNIC (Optional)" className="w-full bg-surface-ground p-2 rounded border border-white/10 text-white text-sm outline-none" value={p2Cnic} onChange={e => setP2Cnic(e.target.value)} />
                        <div 
                            onClick={() => fileInputRef2.current?.click()}
                            className="w-full h-20 border border-dashed border-white/20 rounded flex items-center justify-center text-xs text-content-muted cursor-pointer hover:bg-white/5 relative overflow-hidden"
                        >
                            {p2Photo ? <img src={p2Photo} className="w-full h-full object-cover" /> : "Upload Photo"}
                        </div>
                        <input type="file" ref={fileInputRef2} className="hidden" accept="image/*" onChange={(e) => handleUpload(e, setP2Photo)} />
                    </div>
                )}
            </div>

            <button disabled={isSubmitting} type="submit" className="w-full bg-brand hover:bg-brand-light text-content-inverse py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null} {isAmericanoMode ? "Enroll Player" : "Enroll Team"}
            </button>
        </form>
    </Sheet>
  );
};
