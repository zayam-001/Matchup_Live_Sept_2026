import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { registerPlayer, loginPlayer, loginReferee, loginOrganiser, changeOrganiserPassword, skipOrganiserPasswordChange, loginWithGoogle, completeGoogleSignUp, subscribeToTournaments, setPlayerPersistence } from '../services/storage';
import { db, auth } from '../services/storage';
import { collection, doc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { SkillLevel, Tournament } from '../types';
import { ArrowRight, Trophy, Shield, Activity, Loader2, User, Lock, ChevronRight, Eye, EyeOff, Mail } from 'lucide-react';
import './landing/home.css';
import './auth.css';

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
    // Opens on Sign in. Only a sign-up call to action ("Start playing", /signup)
    // asks for Create account, via a one-shot session flag.
    const [isLogin, setIsLogin] = useState(() => {
        try {
            const intent = sessionStorage.getItem('mu_auth_intent');
            sessionStorage.removeItem('mu_auth_intent');
            return intent !== 'signup';
        } catch { return true; }
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

    const field = (label: string, input: React.ReactNode, span = false) => (
        <div className={`auth__field ${span ? 'auth__field--span' : ''}`}>
            <span className="auth__label">{label}</span>
            {input}
        </div>
    );
    const passwordInput = (value: string, set: (v: string) => void, shown: boolean, toggle: () => void, placeholder = '••••••••') => (
        <div className="auth__input-wrap">
            <Lock size={16} className="auth__input-icon" />
            <input required type={shown ? 'text' : 'password'} value={value} onChange={(e) => set(e.target.value)} className="auth__input auth__input--icon auth__input--trail" placeholder={placeholder} />
            <button type="button" onClick={toggle} className="auth__eye" aria-label={shown ? 'Hide' : 'Show'}>{shown ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
    );
    const segIndex = accessMode === 'player' ? 0 : 1;
    const tabIndex = accessMode === 'player' ? (isLogin ? 0 : 1) : (opRole === 'admin' ? 0 : 1);
    const creating = accessMode === 'player' && (!isLogin || !!googleUser);

    return (
        <div className="auth">
            {/* ── Visual side: the live court, the racket and the pitch ── */}
            <div className="auth__visual">
                <div className="home home--motion home--hero-in auth__scene" aria-hidden="true">
                    <div className="auth__court-wrap">
                        <div className="h-court">
                            <span className="h-court__line h-court__line--outer" />
                            <span className="h-court__line h-court__line--mid" />
                            <span className="h-court__line h-court__line--sl" />
                            <span className="h-court__line h-court__line--sr" />
                            <span className="h-court__net" />
                            <span className="h-court__player h-court__player--1" />
                            <span className="h-court__player h-court__player--2" />
                            <span className="h-court__player h-court__player--3" />
                            <span className="h-court__player h-court__player--4" />
                            <span className="h-court__bounce" />
                            <span className="h-court__rally"><span className="h-court__ball" /></span>
                        </div>
                    </div>
                </div>
                <div className="auth__pitch">
                    <span className="auth__kicker"><span className="auth__dot" /> {accessMode === 'player' ? 'Player portal' : 'Operations console'}</span>
                    <h1 className="auth__title">
                        {accessMode === 'player' ? <>Your global<br /><span>sports identity.</span></> : <>Run every<br /><span>match live.</span></>}
                    </h1>
                    <p className="auth__lede">
                        {accessMode === 'player'
                            ? 'Join the premier tournament platform. Manage your teams, track your stats, and compete in broadcast-ready events across the country.'
                            : 'Organisers and referees: schedule, score and broadcast tournaments from one console.'}
                    </p>
                    <div className="auth__pills">
                        <span className="auth__pill"><Trophy size={15} /> Unified history</span>
                        <span className="auth__pill"><Activity size={15} /> Live stats</span>
                        <span className="auth__pill"><Shield size={15} /> Verified identity</span>
                    </div>
                </div>
            </div>

            {/* ── Form side ── */}
            <div className="auth__side">
                <motion.div className="auth__panel" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
                    <div className="auth__seg" style={{ '--i': segIndex } as React.CSSProperties}>
                        <span className="auth__seg-pill" aria-hidden="true" />
                        <button type="button" onClick={() => { handleSwitchMode('player'); setError(''); }} className={accessMode === 'player' ? 'is-on' : ''}>Player access</button>
                        <button type="button" onClick={() => { handleSwitchMode('operations'); setError(''); }} className={accessMode === 'operations' ? 'is-on' : ''}>Admin / Staff</button>
                    </div>

                    <div className="auth__tabs" style={{ '--i': tabIndex } as React.CSSProperties}>
                        <span className="auth__tabs-bar" aria-hidden="true" />
                        {accessMode === 'player' ? (
                            <>
                                <button type="button" onClick={() => { if (!googleUser) { setIsLogin(true); setError(''); } }} className={isLogin ? 'is-on' : ''}>Sign in</button>
                                <button type="button" onClick={() => { if (!googleUser) { setIsLogin(false); setError(''); } }} className={!isLogin ? 'is-on' : ''}>Create account</button>
                            </>
                        ) : (
                            <>
                                <button type="button" onClick={() => { setOpRole('admin'); setError(''); }} className={opRole === 'admin' ? 'is-on' : ''}>Admin</button>
                                <button type="button" onClick={() => { setOpRole('referee'); setError(''); }} className={opRole === 'referee' ? 'is-on' : ''}>Referee</button>
                            </>
                        )}
                    </div>

                    {error && <div className="auth__alert auth__alert--error">{error}</div>}

                    <motion.div key={`${accessMode}-${isLogin}-${opRole}`} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
                        {accessMode === 'player' ? (
                            <>
                                {!googleUser ? (
                                    <>
                                        <button onClick={handleGoogleSignIn} disabled={isLoading} className="auth__google">
                                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                            </svg>
                                            Continue with Google
                                        </button>
                                        <div className="auth__or"><span>or</span></div>
                                    </>
                                ) : (
                                    <div className="auth__alert auth__alert--info">Almost there! Please complete your profile to finish signing up.</div>
                                )}

                                <form onSubmit={handleSubmit} className={`auth__form ${creating ? 'auth__form--grid' : ''}`}>
                                    {creating && (
                                        <>
                                            {field('Full name', <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="auth__input" placeholder="e.g. Ali Hassan" />)}
                                            {field('Phone number', <input required type="tel" value={phone} onChange={handlePhoneChange} className="auth__input" placeholder="+923000000000" />)}
                                            {field('CNIC', <input required type="text" value={cnic} onChange={(e) => { if (/^[\d-]*$/.test(e.target.value)) handleCnicChange(e); }} className="auth__input" placeholder="XXXXX-XXXXXXX-X" />)}
                                            {field('Gender', (
                                                <select value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')} className="auth__input auth__select">
                                                    <option value="male">Male</option>
                                                    <option value="female">Female</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            ))}
                                            {field('Skill level', (
                                                <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value as SkillLevel)} className="auth__input auth__select">
                                                    <option value={SkillLevel.NEWCOMER}>Newcomer</option>
                                                    <option value={SkillLevel.BEGINNER}>Beginner</option>
                                                    <option value={SkillLevel.INTERMEDIATE}>Intermediate</option>
                                                    <option value={SkillLevel.ADVANCED}>Advanced</option>
                                                    <option value={SkillLevel.PROFESSIONAL}>Professional</option>
                                                </select>
                                            ))}
                                            {field('Promo code (optional)', <input type="text" value={promoCode} onChange={(e) => { if (!promoCodeReadOnly) setPromoCode(e.target.value.toUpperCase()); }} readOnly={promoCodeReadOnly} className={`auth__input uppercase ${promoCodeReadOnly ? 'is-readonly' : ''}`} placeholder="e.g. PADEL24" maxLength={6} />)}
                                        </>
                                    )}
                                    {field('Email address', (
                                        <div className="auth__input-wrap">
                                            <Mail size={16} className="auth__input-icon" />
                                            <input required type="email" value={googleUser ? googleUser.email : email} onChange={(e) => setEmail(e.target.value)} disabled={!!googleUser} className={`auth__input auth__input--icon ${googleUser ? 'is-readonly' : ''}`} placeholder="player@example.com" />
                                        </div>
                                    ), creating)}
                                    {field('Password', passwordInput(password, setPassword, showPassword, () => setShowPassword(!showPassword)), creating)}
                                    <label className="auth__remember">
                                        <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                                        <span>Remember this device</span>
                                    </label>
                                    <button type="submit" disabled={isLoading} className="auth__submit">
                                        {isLoading ? <Loader2 size={20} className="animate-spin" /> : <>{isLogin ? 'Enter portal' : 'Create identity'}<ArrowRight size={18} /></>}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <form onSubmit={handleSubmit} className="auth__form">
                                {opRole === 'admin' ? (
                                    <>
                                        {field('Admin email', (
                                            <div className="auth__input-wrap">
                                                <Mail size={16} className="auth__input-icon" />
                                                <input required type="email" value={opEmail} onChange={(e) => setOpEmail(e.target.value)} className="auth__input auth__input--icon" placeholder="admin@example.com" />
                                            </div>
                                        ))}
                                        {field('Password', passwordInput(opPassword, setOpPassword, showOpPassword, () => setShowOpPassword(!showOpPassword)))}
                                    </>
                                ) : (
                                    <>
                                        {tournamentId ? (
                                            <div className="auth__tournament">
                                                <span>Tournament</span>
                                                <strong>{tournaments.find(t => t.id === tournamentId || t.slug === tournamentId)?.name || 'Loading...'}</strong>
                                            </div>
                                        ) : field('Select tournament', (
                                            <div className="auth__input-wrap">
                                                <select required value={selectedTournamentId} onChange={(e) => setSelectedTournamentId(e.target.value)} className="auth__input auth__select">
                                                    <option value="" disabled className="text-black bg-white">Select a tournament</option>
                                                    {tournaments.map(t => <option key={t.id} value={t.id} className="text-black bg-white">{t.name}</option>)}
                                                </select>
                                                <ChevronRight className="auth__chev" size={16} />
                                            </div>
                                        ))}
                                        {field('Referee passcode', passwordInput(opPasscode, setOpPasscode, showOpPasscode, () => setShowOpPasscode(!showOpPasscode), 'Enter tournament passcode'))}
                                    </>
                                )}
                                <button type="submit" disabled={isLoading} className="auth__submit">
                                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <>Access console<ArrowRight size={18} /></>}
                                </button>
                            </form>
                        )}
                    </motion.div>

                    <p className="auth__terms">
                        By continuing, you agree to the Match Up <a href="#privacy">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.
                    </p>
                </motion.div>
            </div>
        </div>
    );
};
