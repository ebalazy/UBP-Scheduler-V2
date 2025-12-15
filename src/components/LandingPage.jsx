import { useState } from 'react';
import { ArrowRightIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import AuthModal from './auth/AuthModal';
import ubpLogo from '../assets/ubp_logo.jpg';

export default function LandingPage() {
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-blue-500 selection:text-white">
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

            {/* Background Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/20 via-slate-950 to-black z-0 pointer-events-none"></div>

            {/* Subtle Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 z-0 pointer-events-none"></div>

            <main className="relative z-10 w-full max-w-md px-6 py-12 flex flex-col items-center">

                {/* Corporate Logo */}
                <div className="h-32 w-32 bg-white rounded-full shadow-2xl shadow-blue-900/10 mb-10 flex items-center justify-center p-0.5 overflow-hidden ring-4 ring-slate-900">
                    <img
                        src={ubpLogo}
                        alt="UBP Logo"
                        className="h-full w-full object-contain"
                    />
                </div>

                {/* Portal Title */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Operations Portal</h1>
                    <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
                        <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
                        <span>Authorized Personnel Only</span>
                    </div>
                </div>

                {/* Login Action */}
                <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full group bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-900/30 transition-all duration-200 flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
                >
                    <span>Sign In to Dashboard</span>
                    <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>

                <div className="mt-8 text-center">
                    <p className="text-slate-600 text-xs">
                        By accessing this system, you agree to the corporate usage policy.
                    </p>
                </div>
            </main>

            <footer className="absolute bottom-6 w-full text-center">
                <p className="text-slate-700 text-xs font-medium">
                    &copy; {new Date().getFullYear()} Union Beverage Packers. All rights reserved.
                </p>
            </footer>
        </div>
    );
}
