import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheckIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import ubpLogo from '../assets/ubp_logo.jpg';

export default function LandingPage() {
    const { signIn, resendVerificationEmail } = useAuth();

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [resent, setResent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await signIn(email, password);
            // App.jsx will automatically switch view upon user state change
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        try {
            setLoading(true);
            await resendVerificationEmail(email);
            setResent(true);
            setError("Confirmation email resent! Check your spam folder.");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-blue-500 selection:text-white">

            {/* Background Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/20 via-slate-950 to-black z-0 pointer-events-none"></div>

            {/* Subtle Grid Pattern */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 z-0 pointer-events-none"></div>

            <main className="relative z-10 w-full max-w-sm px-4">

                {/* Login Card */}
                <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl">

                    {/* Header Section */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="h-20 w-20 bg-white rounded-full p-0.5 shadow-xl shadow-blue-900/20 mb-4 overflow-hidden ring-2 ring-slate-800">
                            <img src={ubpLogo} alt="UBP" className="h-full w-full object-contain" />
                        </div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Operations Portal</h1>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                            <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Authorized Access Only</span>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className={`p-3 rounded-lg mb-6 text-xs font-medium border flex gap-2 items-start ${error.includes('resent') ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : 'bg-rose-900/20 text-rose-400 border-rose-900/50'}`}>
                            {error.includes('resent') ? <CheckCircleIcon className="w-4 h-4 shrink-0" /> : <ExclamationCircleIcon className="w-4 h-4 shrink-0" />}
                            <div>
                                {error}
                                {(error.includes('Email not confirmed')) && !resent && (
                                    <button
                                        onClick={handleResend}
                                        className="block mt-1 underline hover:text-white transition-colors"
                                    >
                                        Resend Verification Email
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 py-2.5 px-4 text-sm transition-all"
                                placeholder="name@unionbevnj.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 py-2.5 px-4 text-sm transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Signing In...
                                    </span>
                                ) : (
                                    'Sign In to Dashboard'
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 text-center border-t border-slate-800/50 pt-4">
                        <p className="text-slate-500 text-xs">
                            Sign In to access planning tool.
                        </p>
                    </div>

                </div>

            </main>

            <footer className="absolute bottom-6 w-full text-center">
                <p className="text-slate-800 text-[10px] font-medium uppercase tracking-wider">
                    &copy; {new Date().getFullYear()} Union Beverage Packers
                </p>
            </footer>
        </div>
    );
}
