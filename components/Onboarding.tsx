import React, { useState } from 'react';
import { signUpUser } from '../services/storage';
import { User } from '../types';
import { Loader2, ArrowRight, CheckCircle2, Trophy, Activity } from 'lucide-react';

interface OnboardingProps {
  onComplete: (user: User) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+92');
  const [promoCode, setPromoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith('+92')) {
      val = '+92' + val.replace(/^\+92/, '');
    }
    const numericPart = val.substring(3).replace(/\D/g, '');
    setPhone('+92' + numericPart);
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (fullName.trim().length < 3) {
      setError('Please enter your full name.');
      return;
    }
    const phoneRegex = /^\+92\d{10}$/;
    if (!phoneRegex.test(phone)) {
      setError('Phone number must be +92 followed by 10 digits.');
      return;
    }
    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const newUser = await signUpUser(fullName, phone, promoCode || undefined);
      setUser(newUser as User);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to sign up. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 3 && user) {
    return (
      <div className="min-h-screen pt-28 md:pt-36 flex flex-col items-center justify-center text-center p-6">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Welcome, {user.fullName}!</h2>
        <p className="text-gray-400 mb-8">Your player profile is ready.</p>
        
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 w-full max-w-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400">Total Points</span>
            <span className="text-2xl font-bold text-green-400 flex items-center gap-2">
              <Trophy className="w-5 h-5" /> 0
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Matches Played</span>
            <span className="text-2xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" /> 0
            </span>
          </div>
        </div>

        <button
          onClick={() => onComplete(user)}
          className="w-full max-w-sm bg-green-500 hover:bg-green-600 text-black font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          Let's Play <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 md:pt-36 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            {step === 1 ? 'Join Match Up' : 'Got a Promo Code?'}
          </h2>
          <p className="text-gray-400">
            {step === 1 ? 'Enter your details to start playing.' : 'Optional: Enter a promo code to earn rewards.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                placeholder="+923001234567"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleStep2Submit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Promo Code (Optional)</label>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors uppercase"
                placeholder="e.g. PADEL24"
                maxLength={6}
              />
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleStep2Submit}
                disabled={isLoading}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-xl transition-colors"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-green-500 hover:bg-green-600 text-black font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
