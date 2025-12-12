import { useState, useEffect } from 'react';
import { Cog6ToothIcon, UserCircleIcon, ArrowRightOnRectangleIcon, PrinterIcon, CloudIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import AuthModal from './auth/AuthModal';

export default function Header({ onOpenSettings }) {
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
        <header className="bg-white dark:bg-gray-800 shadow relative z-10 transition-colors duration-200">
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                {/* 1. Logo Section */}
                <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 p-2 rounded-lg shadow-md">
                        <span className="text-2xl">🥤</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                            Beverage Scheduler
                            <span className="block text-xs text-blue-600 font-medium">UBP Co-Packer Edition</span>
                        </h1>
                        {user && <span className="text-xs text-green-600 font-medium md:hidden">Logged in as {user.email}</span>}
                    </div>
                </div>

                {/* 2. Global Actions */}
                <div className="flex items-center space-x-2 md:space-x-4 no-print">

                    {/* Sync Status - Always Show */}
                    {user ? (
                        <div className="flex items-center text-sm font-medium transition-colors" title={isOnline ? "Synced to Cloud" : "Offline Mode"}>
                            <CloudIcon className={`h-6 w-6 mr-1 ${isOnline ? 'text-green-500' : 'text-gray-400'}`} />
                            <span className={`hidden md:inline ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                                {isOnline ? 'Saved' : 'Offline'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center text-sm font-medium text-gray-400" title="Local Data Only (Not Logged In)">
                            <CloudIcon className="h-6 w-6 mr-1" />
                            <span className="hidden md:inline">Local Only</span>
                        </div>
                    )}

                    {/* Print Button -- NEW */}
                    <button
                        onClick={() => window.print()}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors hidden md:block"
                        title="Print View"
                    >
                        <PrinterIcon className="h-6 w-6" />
                    </button>

                    <button
                        onClick={onOpenSettings}
                        className="flex items-center space-x-2 px-3 py-2 bg-white text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg border border-gray-200 shadow-sm transition-all"
                        title="Settings"
                    >
                        <Cog6ToothIcon className="h-5 w-5 md:mr-2" />
                        <span className="hidden md:inline font-medium">Settings</span>
                    </button>

                    {/* Auth Controls */}
                    {user ? (
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-500 hidden md:inline">{user.email}</span>
                            <button
                                onClick={signOut}
                                className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                title="Sign Out"
                            >
                                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAuthModalOpen(true)}
                            className="flex items-center text-white bg-blue-600 hover:bg-blue-700 font-medium px-4 py-2 rounded-md transition-colors shadow-sm"
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
