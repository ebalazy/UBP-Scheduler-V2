import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ubpLogo from '../../assets/ubp_logo_v4.png';

export default function AuthModal({ isOpen, onClose }) {
    const { signIn, signUp, resendVerificationEmail } = useAuth();
    const [isSignUp, setIsSignUp] = useState(false);

    // State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [resent, setResent] = useState(false);
    const [successMsg, setSuccessMsg] = useState(null);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);
        setLoading(true);

        try {
            if (isSignUp) {
                await signUp(email, password);
                setSuccessMsg("Account created! Please check your email to confirm your account before logging in.");
                setIsSignUp(false); // Switch to login view
            } else {
                await signIn(email, password);
                onClose();
            }
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <XMarkIcon className="h-6 w-6" />
                </button>

                <div className="p-8">
                    {/* Brand Logo */}
                    <div className="flex justify-center mb-6">
                        <div className="h-20 w-20 bg-white rounded-full shadow-2xl shadow-blue-500/20 flex items-center justify-center overflow-hidden">
                            <img src={ubpLogo} alt="UBP" className="h-full w-full object-cover transform scale-105" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2 text-center">
                        {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </h2>
                    <p className="text-gray-400 text-sm mb-6 text-center">
                        {isSignUp
                            ? 'Set up your credentials to access the system.'
                            : 'Sign in to access your production schedule.'}
                    </p>

                    {/* Toggle Tabs */}
                    <div className="flex bg-gray-800 rounded-lg p-1 mb-6">
                        <button
                            onClick={() => { setIsSignUp(false); setError(null); }}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${!isSignUp ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => { setIsSignUp(true); setError(null); }}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${isSignUp ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {successMsg && (
                        <div className="p-3 rounded-lg mb-4 text-sm font-bold bg-green-900/30 text-green-300 border border-green-800">
                            {successMsg}
                        </div>
                    )}

                    {error && (
                        <div className={`p-3 rounded-lg mb-4 text-sm font-medium border ${error.includes('resent') ? 'bg-green-900/30 text-green-300 border-green-800' : 'bg-red-900/30 text-red-300 border-red-800'}`}>
                            {error}
                            {/* Show Resend Button if error implies unconfirmed email */}
                            {(error.includes('Email not confirmed')) && !resent && !isSignUp && (
                                <button
                                    onClick={handleResend}
                                    className="block mt-2 text-xs font-bold underline hover:text-green-200"
                                >
                                    Resend Verification Email
                                </button>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full rounded-lg bg-gray-800 border-gray-700 text-white placeholder-gray-500 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border transition-colors"
                                placeholder="name@company.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300">
                                {isSignUp ? 'Set Password' : 'Password'}
                            </label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full rounded-lg bg-gray-800 border-gray-700 text-white placeholder-gray-500 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border transition-colors"
                                placeholder="••••••••"
                            />
                            {isSignUp && <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters.</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full text-white rounded-lg py-2.5 font-bold transition-all disabled:opacity-50 shadow-lg ${isSignUp ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'}`}
                        >
                            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-500">
                        <span className="italic">Authorized personnel only.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
