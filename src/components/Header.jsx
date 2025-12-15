import { useState, useEffect } from 'react';
import { Cog6ToothIcon, UserCircleIcon, ArrowRightOnRectangleIcon, PrinterIcon, CloudIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import AuthModal from './auth/AuthModal';

export default function Header({ onOpenSettings, isSaving, saveError }) {
    const { user, signOut } = useAuth();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <header className="bg-slate-900 border-b border-slate-800 shadow-sm relative z-30 transition-colors duration-200">
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

            <div className="max-w-[1920px] mx-auto px-4 lg:px-6 py-2.5 flex justify-between items-center">
                {/* 1. Logo Section */}
                <div className="flex items-center gap-3.5">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/40 transform transition-transform hover:scale-105 cursor-default">
                        <span className="text-xl">🥤</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-tight leading-none">
                            Beverage <span className="opacity-90 font-light">Scheduler</span>
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5 opacity-80">
                            UBP Co-Packer Edition
                        </p>
                    </div>
                </div>

                {/* 2. Global Actions */}
                <div className="flex items-center gap-4 no-print">

                    {/* Sync Status - Always Show */}
                    {user ? (
                        <div className="flex items-center text-sm font-medium transition-colors bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50" title={saveError || (isOnline ? "Cloud Synced" : "Offline Mode")}>
                            <CloudIcon className={`h-4 w-4 mr-2 ${isSaving ? 'text-blue-400 animate-pulse' : saveError ? 'text-red-500' : isOnline ? 'text-emerald-500' : 'text-slate-500'}`} />
                            <span className={`hidden md:inline text-xs font-bold uppercase tracking-wide ${isSaving ? 'text-blue-400' : saveError ? 'text-red-400' : isOnline ? 'text-emerald-500' : 'text-slate-500'}`}>
                                {isSaving ? 'Saving...' : saveError ? 'Sync Error' : isOnline ? 'All Saved' : 'Offline'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center text-sm font-medium text-slate-500 px-3 py-1.5 bg-slate-800/50 rounded-full" title="Local Data Only">
                            <CloudIcon className="h-4 w-4 mr-2" />
                            <span className="hidden md:inline text-xs font-bold uppercase tracking-wide">Local Only</span>
                        </div>
                    )}

                    <div className="w-px h-6 bg-slate-700 hidden md:block mx-2"></div>

                    {/* Tool Icons */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => window.print()}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                            title="Print View"
                        >
                            <PrinterIcon className="h-5 w-5" />
                        </button>

                        <button
                            onClick={onOpenSettings}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all group"
                            title="Settings"
                        >
                            <Cog6ToothIcon className="h-5 w-5 group-hover:rotate-90 transition-transform duration-500" />
                        </button>
                    </div>

                    <div className="w-px h-6 bg-slate-700 hidden md:block mx-2"></div>

                    {/* Auth Controls */}
                    {user ? (
                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex flex-col items-end">
                                <span className="text-sm font-semibold text-slate-200 leading-none">{user.email?.split('@')[0]}</span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">{user.email?.split('@')[1] || 'Union Bev'}</span>
                            </div>
                            <button
                                onClick={signOut}
                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-all"
                                title="Sign Out"
                            >
                                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAuthModalOpen(true)}
                            className="flex items-center text-white bg-blue-600 hover:bg-blue-500 font-bold px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-900/20 text-sm"
                        >
                            <UserCircleIcon className="h-5 w-5 md:mr-2" />
                            <span className="hidden md:inline">Sign In</span>
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
