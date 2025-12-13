import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function AuthModal({ isOpen, onClose }) {
    const { signIn, resendVerificationEmail } = useAuth(); // Removed signUp

    // State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [resent, setResent] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await signIn(email, password);
            onClose();
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
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Welcome Back
                    </h2>
                    <p className="text-gray-400 text-sm mb-6">
                        Sign in to access your production schedule.
                    </p>

                    {error && (
                        <div className={`p-3 rounded-lg mb-4 text-sm font-medium border ${error.includes('resent') ? 'bg-green-900/30 text-green-300 border-green-800' : 'bg-red-900/30 text-red-300 border-red-800'}`}>
                            {error}
                            {/* Show Resend Button if error implies unconfirmed email */}
                            {(error.includes('Email not confirmed')) && !resent && (
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
                            <label className="block text-sm font-medium text-gray-300">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full rounded-lg bg-gray-800 border-gray-700 text-white placeholder-gray-500 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-bold hover:bg-blue-500 transition-all disabled:opacity-50 shadow-lg shadow-blue-900/20"
                        >
                            {loading ? 'Processing...' : 'Sign In'}
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
