import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { registerPlayer, loginPlayer, loginReferee, loginOrganiser, changeOrganiserPassword, skipOrganiserPasswordChange, loginWithGoogle, completeGoogleSignUp, subscribeToTournaments, setPlayerPersistence } from '../services/storage';
import { db, auth } from '../services/storage';
import { collection, doc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { SkillLevel, Tournament } from '../types';
import { ArrowRight, Trophy, Shield, Activity, Loader2, User, Lock, ChevronRight, Eye, EyeOff, Mail } from 'lucide-react';

export const Auth: React.FC<{ 
    initialMode: 'player' | 'operations', 
    tournamentId?: string,
    onAuthSuccess: (role: 'player' | 'admin' | 'referee', tournamentId?: string) => void 
}> = ({ initialMode, tournamentId, onAuthSuccess }) => {
    const [accessMode, setAccessMode] = useState<'player' | 'operations'>(initialMode);

    // Sync state if prop changes (via back button etc)
    useEffect(() => {
        setAccessMode(initialMode);
    }, [initialMode]);

    useEffect(() => {
        if (tournamentId && accessMode === 'operations') {
            setOpRole('referee');
            setSelectedTournamentId(tournamentId);
        }
    }, [tournamentId, accessMode]);

    const handleSwitchMode = (mode: 'player' | 'operations') => {
        setAccessMode(mode);
        window.location.hash = mode === 'player' ? 'auth-player' : 'auth-admin';
    };
    const [isLogin, setIsLogin] = useState(() => {
        return !!localStorage.getItem('deviceId');
    });
    const [googleUser, setGoogleUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [rememberMe, setRememberMe] = useState(true);

    // Player Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('+92');
    const [cnic, setCnic] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
    const [promoCode, setPromoCode] = useState('');
    const [promoCodeReadOnly, setPromoCodeReadOnly] = useState(false);
    const [skillLevel, setSkillLevel] = useState<SkillLevel>(SkillLevel.INTERMEDIATE);

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const promo = queryParams.get('promo');
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const hashPromo = hashParams.get('promo');

        const foundPromo = promo || hashPromo;

        if (foundPromo) {
            setPromoCode(foundPromo);
            setPromoCodeReadOnly(true);
            setIsLogin(false); // Force signup mode if promo code is present
        }
    }, []);

    // Operations Form State
    const [opRole, setOpRole] = useState<'admin' | 'referee'>('admin');
    const [opEmail, setOpEmail] = useState('');
    const [opPassword, setOpPassword] = useState('');
    const [opPasscode, setOpPasscode] = useState('');
    const [selectedTournamentId, setSelectedTournamentId] = useState('');
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    
    // Organiser Password Rest State
    const [showForcePasswordChange, setShowForcePasswordChange] = useState(false);
    const [newOpPassword, setNewOpPassword] = useState('');
    const [confirmNewOpPassword, setConfirmNewOpPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showOpPassword, setShowOpPassword] = useState(false);
    const [showOpPasscode, setShowOpPasscode] = useState(false);
    const [showNewOpPassword, setShowNewOpPassword] = useState(false);
    const [showConfirmNewOpPassword, setShowConfirmNewOpPassword] = useState(false);

    useEffect(() => {
        if (accessMode === 'operations' && opRole === 'referee') {
            const unsub = subscribeToTournaments((data) => setTournaments(data));
            return () => unsub();
        }
    }, [accessMode, opRole]);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        // Ensure it always starts with +92
        if (!val.startsWith('+92')) {
            val = '+92' + val.replace(/^\+92/, '');
        }
        // Remove any non-numeric characters after +92
        const numericPart = val.substring(3).replace(/\D/g, '');
        setPhone('+92' + numericPart);
    };

    const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, ''); // Remove non-numeric
        if (val.length > 13) val = val.substring(0, 13); // Max 13 digits
        
        // Format as XXXXX-XXXXXXX-X
        let formatted = val;
        if (val.length > 5) {
            formatted = val.substring(0, 5) + '-' + val.substring(5);
        }
        if (val.length > 12) {
            formatted = formatted.substring(0, 13) + '-' + val.substring(12);
        }
        setCnic(formatted);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (accessMode === 'player') {
            if (!isLogin || googleUser) {
                const phoneRegex = /^\+92\d{10}$/; // +92 followed by 10 digits
                if (!phoneRegex.test(phone)) {
                    setError('Phone number must be in the format +92XXXXXXXXXX (10 digits after +92)');
                    setIsLoading(false);
                    return;
                }
                const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
                if (!cnicRegex.test(cnic)) {
                    setError('CNIC must be in the format XXXXX-XXXXXXX-X');
                    setIsLoading(false);
                    return;
                }
                if (!googleUser) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email)) {
                        setError('Please enter a valid email address');
                        setIsLoading(false);
                        return;
                    }
                }
            }
        }

        try {
            if (accessMode === 'player') {
                await setPlayerPersistence(rememberMe);
                if (googleUser) {
                    await completeGoogleSignUp(googleUser, { name, phone, cnic, gender, skillLevel, password, promoCode });
                    if (rememberMe) {
                        localStorage.setItem('deviceId', crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
                    } else {
                        localStorage.removeItem('deviceId');
                    }
                    onAuthSuccess('player');
                } else if (isLogin) {
                    await loginPlayer(email, password);
                    if (rememberMe) {
                        localStorage.setItem('deviceId', crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
                    } else {
                        localStorage.removeItem('deviceId');
                    }
                    onAuthSuccess('player');
                } else {
                    await registerPlayer({ name, email, phone, cnic, gender, skillLevel, password, promoCode });
                    if (rememberMe) {
                        localStorage.setItem('deviceId', crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
                    } else {
                        localStorage.removeItem('deviceId');
                    }
                    onAuthSuccess('player');
                }
            } else {
                if (opRole === 'admin') {
                    const lowEmail = opEmail.toLowerCase();
                    const isHardcodedAdmin = (lowEmail === 'zayam@test.com' || lowEmail === 'zayam.anjum@gmail.com' || lowEmail === 'taha.nadeem@maidan.pk' || lowEmail === 'taha.nadeem@maidan' || lowEmail === 'info@matchup.com.pk');
                    
                    if (isHardcodedAdmin && (opPassword === 'Test123!@#' || opPassword === 'Zayam@001')) {
                        try {
                            const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
                            if (auth) {
                                try {
                                    await signInWithEmailAndPassword(auth, opEmail, opPassword);
                                } catch (firebaseErr: any) {
                                    if (firebaseErr.code === 'auth/user-not-found' || firebaseErr.code === 'auth/invalid-credential') {
                                        try {
                                            await createUserWithEmailAndPassword(auth, opEmail, opPassword);
                                        } catch (createErr) {
                                            console.warn("Failed to dynamically register hardcoded admin:", createErr);
                                        }
                                    } else {
                                        console.warn("Firebase signin error for hardcoded admin:", firebaseErr);
                                    }
                                }
                            }
                        } catch (err) {
                            console.error("Firebase Auth dynamic initialization error:", err);
                        }
                        localStorage.setItem('admin_session', JSON.stringify({ timestamp: Date.now() }));
                        onAuthSuccess('admin');
                    } else {
                        const { organiserData } = await loginOrganiser(opEmail, opPassword);
                        
                        // Validate role for Admin portal
                        if (organiserData?.role !== 'admin' && organiserData?.role !== 'organiser') {
                            throw new Error("Account does not have admin/staff privileges.");
                        }

                        localStorage.setItem('admin_session', JSON.stringify({ timestamp: Date.now() }));
                        if (organiserData?.mustChangePassword) {
                            setShowForcePasswordChange(true);
                        } else {
                            onAuthSuccess('admin');
                        }
                    }
                } else if (opRole === 'referee') {
                    const t = tournaments.find(t => t.id === selectedTournamentId || t.slug === selectedTournamentId);
                    if (!t) throw new Error("Please select a tournament.");
                    
                    if (opPasscode === t.refereePasscode) {
                        try {
                            await loginReferee();
                        } catch (e) {
                            console.warn("Anonymous sign-in failed, continuing with local session:", e);
                        }
                        localStorage.setItem('referee_session', JSON.stringify({ timestamp: Date.now(), tournamentId: t.id }));
                        onAuthSuccess('referee', t.id);
                    } else {
                        throw new Error("Invalid tournament passcode.");
                    }
                }
            }
        } catch (err: any) {
            let errorMessage = err.message || "Authentication failed. Please try again.";
            if (err.code === 'auth/invalid-credential') {
                errorMessage = "Invalid email or password. If you originally signed up with Google, please use the 'Continue with Google' button above.";
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setIsLoading(true);
        try {
            const { user, isNewUser } = await loginWithGoogle();
            await setPlayerPersistence(rememberMe);
            
            if (isNewUser) {
                setGoogleUser(user);
                setIsLogin(false);
                if (user.displayName) setName(user.displayName);
                if (user.phoneNumber) setPhone(user.phoneNumber);
            } else {
                // Check for Admin/Organiser role if we are in operations mode
                if (accessMode === 'operations') {
                    if (db) {
                        try {
                            const adminSnap = await getDoc(doc(db, 'adminUsers', user.uid));
                            if (adminSnap.exists()) {
                                localStorage.setItem('admin_session', JSON.stringify({ timestamp: Date.now() }));
                                onAuthSuccess('admin');
                                return;
                            }
                            
                            const userSnap = await getDoc(doc(db, 'users', user.uid));
                            if (userSnap.exists()) {
                                const userData = userSnap.data();
                                if (userData.role === 'admin' || userData.role === 'organiser') {
                                    localStorage.setItem('admin_session', JSON.stringify({ timestamp: Date.now() }));
                                    onAuthSuccess('admin');
                                    return;
                                }
                            }

                            // If not admin, check if email matches the hardcoded one or other rules
                            if (user.email === 'zayam@test.com' || user.email === 'zayam.anjum@gmail.com' || user.email === 'taha.nadeem@maidan.pk') {
                                localStorage.setItem('admin_session', JSON.stringify({ timestamp: Date.now() }));
                                onAuthSuccess('admin');
                                return;
                            }

                            throw new Error("This Google account does not have admin privileges. Please use a different account or contact support.");
                        } catch (e: any) {
                            setError(e.message || "Failed to verify admin privileges.");
                            return;
                        }
                    } else {
                        // If no DB, just let them in if it's the right email
                        if (user.email === 'zayam@test.com' || user.email === 'zayam.anjum@gmail.com' || user.email === 'taha.nadeem@maidan.pk') {
                            localStorage.setItem('admin_session', JSON.stringify({ timestamp: Date.now() }));
                            onAuthSuccess('admin');
                            return;
                        }
                    }
                }
                
                // Fallback to player login if not operations or if admin check didn't specifically redirect
                onAuthSuccess('player');
            }
        } catch (err: any) {
            setError("Google sign-in failed: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (newOpPassword !== confirmNewOpPassword) {
            setError("Passwords do not match.");
            setIsLoading(false);
            return;
        }

        try {
            await changeOrganiserPassword(newOpPassword);
            onAuthSuccess('admin');
        } catch (err: any) {
            setError(err.message || "Failed to update password.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkipPasswordChange = async () => {
        setIsLoading(true);
        try {
            await skipOrganiserPasswordChange();
            onAuthSuccess('admin');
        } catch (err: any) {
            setError(err.message || "Failed to skip.");
        } finally {
            setIsLoading(false);
        }
    };

    if (showForcePasswordChange) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 pt-28 md:pt-36 pb-20">
                <Card className="w-full max-w-md p-8 bg-surface-panel border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="mb-6 flex space-x-3 items-center">
                        <Lock className="text-brand w-6 h-6" />
                        <h2 className="text-2xl font-black text-white">Secure Your Account</h2>
                    </div>
                    <p className="text-content-muted text-sm mb-6">
                        For security reasons, you must change your temporary password before accessing the control tower.
                    </p>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-4 rounded-xl mb-6 flex items-start gap-2">
                            <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">New Password</label>
                            <div className="relative">
                                <input 
                                    required 
                                    type={showNewOpPassword ? "text" : "password"} 
                                    value={newOpPassword}
                                    onChange={(e) => setNewOpPassword(e.target.value)}
                                    className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 pr-12 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                                    placeholder="••••••••" 
                                />
                                <button type="button" onClick={() => setShowNewOpPassword(!showNewOpPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white focus:outline-none">
                                    {showNewOpPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Confirm New Password</label>
                            <div className="relative">
                                <input 
                                    required 
                                    type={showConfirmNewOpPassword ? "text" : "password"} 
                                    value={confirmNewOpPassword}
                                    onChange={(e) => setConfirmNewOpPassword(e.target.value)}
                                    className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 pr-12 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                                    placeholder="••••••••" 
                                />
                                <button type="button" onClick={() => setShowConfirmNewOpPassword(!showConfirmNewOpPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white focus:outline-none">
                                    {showConfirmNewOpPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <button 
                                type="submit" 
                                disabled={isLoading || !newOpPassword || !confirmNewOpPassword}
                                className="w-full bg-brand hover:bg-brand-light text-content-inverse font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 size={20} className="animate-spin" /> : 'Set New Password'}
                            </button>
                            <button 
                                type="button"
                                onClick={handleSkipPasswordChange}
                                disabled={isLoading}
                                className="w-full bg-transparent hover:bg-white/5 border border-white/10 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                Skip for now
                            </button>
                        </div>
                    </form>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 pt-28 md:pt-36 pb-20">
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                
                {/* Branding / Value Prop Side */}
                <div className="hidden lg:flex flex-col justify-center space-y-8 pr-12">
                    <div>
                        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
                            <span className="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
                            <span className="text-xs font-bold uppercase tracking-widest text-content-muted">Player Portal</span>
                        </div>
                        <h1 className="text-5xl font-black text-white tracking-tighter italic leading-tight mb-4">
                            YOUR GLOBAL<br/>
                            <span className="text-brand">SPORTS IDENTITY</span>
                        </h1>
                        <p className="text-content-secondary text-lg font-medium leading-relaxed">
                            Join the premier tournament platform. Manage your teams, track your stats, and compete in broadcast-ready events across the country.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4 bg-surface-panel p-4 rounded-2xl border border-white/5">
                            <div className="bg-brand/10 p-3 rounded-xl text-brand"><Trophy size={24} /></div>
                            <div>
                                <h3 className="text-white font-bold">Unified History</h3>
                                <p className="text-sm text-content-muted">One profile for all your tournaments.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-surface-panel p-4 rounded-2xl border border-white/5">
                            <div className="bg-brand/10 p-3 rounded-xl text-brand"><Activity size={24} /></div>
                            <div>
                                <h3 className="text-white font-bold">Live Stats</h3>
                                <p className="text-sm text-content-muted">Real-time scoring and bracket progression.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-surface-panel p-4 rounded-2xl border border-white/5">
                            <div className="bg-brand/10 p-3 rounded-xl text-brand"><Shield size={24} /></div>
                            <div>
                                <h3 className="text-white font-bold">Verified Identity</h3>
                                <p className="text-sm text-content-muted">Professional profiles for serious competitors.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Auth Form Side */}
                <Card variant="elevated" className="p-8 md:p-10 border-white/10 shadow-2xl relative overflow-hidden">
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                    <div className="relative z-10">
                        {/* Access Mode Toggle */}
                        <div className="flex bg-surface-ground rounded-xl p-1 mb-8 border border-white/5">
                            <button
                                onClick={() => { handleSwitchMode('player'); setError(''); }}
                                className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${accessMode === 'player' ? 'bg-surface-panel text-white shadow-md' : 'text-content-muted hover:text-white'}`}
                            >
                                Player Access
                            </button>
                            <button
                                onClick={() => { handleSwitchMode('operations'); setError(''); }}
                                className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${accessMode === 'operations' ? 'bg-surface-panel text-white shadow-md' : 'text-content-muted hover:text-white'}`}
                            >
                                Admin / Staff
                            </button>
                        </div>

                        {accessMode === 'player' ? (
                            <>
                                <div className="flex gap-6 mb-8 border-b border-white/10">
                                    <button 
                                        onClick={() => { if (!googleUser) { setIsLogin(true); setError(''); } }}
                                        className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${isLogin ? 'text-white' : 'text-content-muted hover:text-content-secondary'}`}
                                    >
                                        Sign In
                                        {isLogin && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full"></div>}
                                    </button>
                                    <button 
                                        onClick={() => { if (!googleUser) { setIsLogin(false); setError(''); } }}
                                        className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${!isLogin ? 'text-white' : 'text-content-muted hover:text-content-secondary'}`}
                                    >
                                        Create Account
                                        {!isLogin && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full"></div>}
                                    </button>
                                </div>

                                {error && (
                                    <div className="mb-6 p-4 bg-accent-error/10 border border-accent-error/20 rounded-xl text-accent-error text-sm font-medium">
                                        {error}
                                    </div>
                                )}

                                {!googleUser && (
                                    <>
                                        <button 
                                            onClick={handleGoogleSignIn}
                                            disabled={isLoading}
                                            className="w-full bg-white text-black hover:bg-gray-100 font-bold py-4 rounded-xl mb-6 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                            </svg>
                                            Continue with Google
                                        </button>

                                        <div className="mb-6 flex items-center gap-4">
                                            <div className="flex-1 h-px bg-white/10"></div>
                                            <span className="text-xs font-bold uppercase tracking-widest text-content-muted">OR</span>
                                            <div className="flex-1 h-px bg-white/10"></div>
                                        </div>
                                    </>
                                )}

                                {googleUser && (
                                    <div className="mb-6 p-4 bg-brand/10 border border-brand/20 rounded-xl text-brand text-sm font-medium">
                                        Almost there! Please complete your profile to finish signing up.
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {(!isLogin || googleUser) && (
                                        <>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Full Name</label>
                                                <input 
                                                    required 
                                                    type="text" 
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                                                    placeholder="e.g. Ali Hassan" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Phone Number</label>
                                                <input 
                                                    required 
                                                    type="tel" 
                                                    value={phone}
                                                    onChange={handlePhoneChange}
                                                    className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                                                    placeholder="+923000000000" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">CNIC</label>
                                                <input 
                                                    required 
                                                    type="text" 
                                                    value={cnic}
                                                    onChange={(e) => {
                                                        // Only allow digits and hyphens
                                                        const val = e.target.value;
                                                        if (/^[\d-]*$/.test(val)) {
                                                            handleCnicChange(e);
                                                        }
                                                    }}
                                                    className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                                                    placeholder="XXXXX-XXXXXXX-X" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Gender</label>
                                                <select 
                                                    value={gender}
                                                    onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
                                                    className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all appearance-none"
                                                >
                                                    <option value="male">Male</option>
                                                    <option value="female">Female</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Skill Level</label>
                                                <select 
                                                    value={skillLevel}
                                                    onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
                                                    className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all appearance-none"
                                                >
                                                    <option value={SkillLevel.NEWCOMER}>Newcomer</option>
                                                    <option value={SkillLevel.BEGINNER}>Beginner</option>
                                                    <option value={SkillLevel.INTERMEDIATE}>Intermediate</option>
                                                    <option value={SkillLevel.ADVANCED}>Advanced</option>
                                                    <option value={SkillLevel.PROFESSIONAL}>Professional</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Promo Code (Optional)</label>
                                                <input 
                                                    type="text" 
                                                    value={promoCode}
                                                    onChange={(e) => {
                                                        if (!promoCodeReadOnly) {
                                                            setPromoCode(e.target.value.toUpperCase());
                                                        }
                                                    }}
                                                    readOnly={promoCodeReadOnly}
                                                    className={`w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all uppercase ${promoCodeReadOnly ? 'opacity-70 cursor-not-allowed bg-white/5' : ''}`} 
                                                    placeholder="e.g. PADEL24" 
                                                    maxLength={6}
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Email Address</label>
                                        <div className="relative">
                                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                            <input
                                                required
                                                type="email"
                                                value={googleUser ? googleUser.email : email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                disabled={!!googleUser}
                                                className={`w-full bg-surface-ground border border-white/10 rounded-xl p-4 pl-12 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all ${googleUser ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                placeholder="player@example.com"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Password</label>
                                        <div className="relative">
                                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                            <input
                                                required
                                                type={showPassword ? "text" : "password"}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 pl-12 pr-12 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                                                placeholder="••••••••"
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white focus:outline-none">
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mt-4">
                                        <input 
                                            type="checkbox" 
                                            id="rememberMe" 
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="w-4 h-4 rounded border-white/10 bg-surface-ground text-brand focus:ring-brand focus:ring-offset-surface-panel"
                                        />
                                        <label htmlFor="rememberMe" className="text-sm text-content-muted cursor-pointer">
                                            Remember this device
                                        </label>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={isLoading}
                                        className="w-full bg-brand hover:bg-brand-light text-content-inverse font-bold py-4 rounded-xl mt-4 transition-all shadow-lg shadow-brand/20 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <Loader2 size={20} className="animate-spin" />
                                        ) : (
                                            <>
                                                {isLogin ? 'Enter Portal' : 'Create Identity'}
                                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <>
                                <div className="flex gap-6 mb-8 border-b border-white/10">
                                    <button 
                                        onClick={() => { setOpRole('admin'); setError(''); }}
                                        className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${opRole === 'admin' ? 'text-white' : 'text-content-muted hover:text-content-secondary'}`}
                                    >
                                        Admin
                                        {opRole === 'admin' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full"></div>}
                                    </button>
                                    <button 
                                        onClick={() => { setOpRole('referee'); setError(''); }}
                                        className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${opRole === 'referee' ? 'text-white' : 'text-content-muted hover:text-content-secondary'}`}
                                    >
                                        Referee
                                        {opRole === 'referee' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full"></div>}
                                    </button>
                                </div>

                                {error && (
                                    <div className="mb-6 p-4 bg-accent-error/10 border border-accent-error/20 rounded-xl text-accent-error text-sm font-medium">
                                        {error}
                                    </div>
                                )}


                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {opRole === 'admin' ? (
                                        <>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Admin Email</label>
                                                <div className="relative">
                                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                                    <input
                                                        required
                                                        type="email"
                                                        value={opEmail}
                                                        onChange={(e) => setOpEmail(e.target.value)}
                                                        className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 pl-12 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                                                        placeholder="admin@example.com"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Password</label>
                                                <div className="relative">
                                                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                                    <input
                                                        required
                                                        type={showOpPassword ? "text" : "password"}
                                                        value={opPassword}
                                                        onChange={(e) => setOpPassword(e.target.value)}
                                                        className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 pl-12 pr-12 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                                                        placeholder="••••••••"
                                                    />
                                                    <button type="button" onClick={() => setShowOpPassword(!showOpPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white focus:outline-none">
                                                        {showOpPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {tournamentId ? (
                                                <div className="bg-surface-panel p-4 rounded-xl border border-brand/20 mb-4">
                                                    <div className="text-xs font-bold uppercase tracking-widest text-brand mb-1">Tournament</div>
                                                    <div className="text-white font-bold">{tournaments.find(t => t.id === tournamentId || t.slug === tournamentId)?.name || "Loading..."}</div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Select Tournament</label>
                                                    <div className="relative">
                                                        <select 
                                                            required
                                                            value={selectedTournamentId}
                                                            onChange={(e) => setSelectedTournamentId(e.target.value)}
                                                            className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all appearance-none"
                                                        >
                                                            <option value="" disabled className="text-black bg-white">Select a tournament</option>
                                                            {tournaments.map(t => (
                                                                <option key={t.id} value={t.id} className="text-black bg-white">{t.name}</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-content-muted">
                                                            <ChevronRight className="rotate-90" size={18} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Referee Passcode</label>
                                                <div className="relative">
                                                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                                    <input
                                                        required
                                                        type={showOpPasscode ? "text" : "password"}
                                                        value={opPasscode}
                                                        onChange={(e) => setOpPasscode(e.target.value)}
                                                        className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 pl-12 pr-12 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                                                        placeholder="Enter tournament passcode"
                                                    />
                                                    <button type="button" onClick={() => setShowOpPasscode(!showOpPasscode)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white focus:outline-none">
                                                        {showOpPasscode ? <EyeOff size={20} /> : <Eye size={20} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <button 
                                        type="submit" 
                                        disabled={isLoading}
                                        className="w-full bg-brand hover:bg-brand-light text-content-inverse font-bold py-4 rounded-xl mt-4 transition-all shadow-lg shadow-brand/20 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <Loader2 size={20} className="animate-spin" />
                                        ) : (
                                            <>
                                                Access Console
                                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </>
                        )}
                        
                        <div className="mt-8 text-center">
                            <p className="text-xs text-content-muted">
                                By continuing, you agree to the Match Up <a href="#privacy" className="text-brand hover:underline">Terms of Service</a> and <a href="#privacy" className="text-brand hover:underline">Privacy Policy</a>.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
