import { useState } from 'react';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import AuthModal from './auth/AuthModal';

export default function LandingPage() {
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col justify-center relative overflow-hidden transition-colors duration-300">
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

            {/* Background Decoration */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-screen filter blur-3xl animate-blob"></div>
                <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-pink-500 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-4000"></div>
            </div>

            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

                {/* Logo & Branding */}
                <div className="mb-8 flex justify-center">
                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-2xl flex items-center space-x-4">
                        <span className="text-5xl">🥤</span>
                        <div className="text-left">
                            <h1 className="text-2xl font-bold text-white leading-none">Beverage Scheduler</h1>
                            <span className="text-sm text-blue-400 font-bold tracking-wider uppercase">UBP Co-Packer Edition</span>
                        </div>
                    </div>
                </div>

                <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-sm">
                    Production planning, <span className="text-blue-500">simplified.</span>
                </h2>
                <p className="max-w-2xl mx-auto text-xl text-gray-400 mb-10">
                    Secure, real-time MRP and Logistics scheduling for the modern co-packer.
                    Manage inventory, trucks, and production lines in one place.
                </p>

                {/* Primary CTA */}
                <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-bold rounded-full shadow-lg shadow-blue-900/20 text-white bg-blue-600 hover:bg-blue-500 transition-all transform hover:-translate-y-1 hover:shadow-blue-500/30"
                >
                    Sign In to Dashboard
                    <ArrowRightIcon className="ml-2 h-5 w-5" />
                </button>

                {/* Feature Glimpse */}
                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                    <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-800 hover:border-gray-700 transition">
                        <span className="text-2xl mb-2 block">📅</span>
                        <h3 className="font-bold text-white">Master Schedule</h3>
                        <p className="text-gray-400 text-sm mt-1">Visualize multi-SKU production runs and detect conflicts instantly.</p>
                    </div>
                    <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-800 hover:border-gray-700 transition">
                        <span className="text-2xl mb-2 block">📦</span>
                        <h3 className="font-bold text-white">Inventory MRP</h3>
                        <p className="text-gray-400 text-sm mt-1">Automated material requirements planning with safety stock alerts.</p>
                    </div>
                    <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-800 hover:border-gray-700 transition">
                        <span className="text-2xl mb-2 block">☁️</span>
                        <h3 className="font-bold text-white">Cloud Sync</h3>
                        <p className="text-gray-400 text-sm mt-1">Data persists securely to the cloud. Access from any device.</p>
                    </div>
                </div>

            </main>

            <footer className="absolute bottom-4 w-full text-center text-gray-600 text-sm z-10">
                &copy; {new Date().getFullYear()} Beverage Scheduler. Authorized Personnel Only.
            </footer>
        </div>
    );
}
