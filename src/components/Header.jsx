import { useState } from 'react';
import { Cog6ToothIcon, UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import AuthModal from './auth/AuthModal';

export default function Header({ onOpenSettings }) {
    const { user, signOut } = useAuth();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    return (
        <header className="bg-white shadow relative z-10">
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div className="flex items-center">
                    {/* Logo / Title */}
                    <div className="bg-blue-600 text-white p-2 rounded-lg mr-3">
                        <span className="text-xl font-bold">UBP</span>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-none">Peter's Bottle Planner</h1>
                        {user && <span className="text-xs text-green-600 font-medium">Logged in as {user.email}</span>}
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {/* Auth Controls */}
                    {user ? (
                        <button
                            onClick={signOut}
                            className="flex items-center text-gray-600 hover:text-red-600 font-medium bg-gray-50 hover:bg-red-50 px-3 py-2 rounded-md transition-colors border border-gray-200"
                            title="Sign Out"
                        >
                            <ArrowRightOnRectangleIcon className="h-5 w-5 md:mr-2" />
                            <span className="hidden md:inline">Sign Out</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsAuthModalOpen(true)}
                            className="flex items-center text-white bg-blue-600 hover:bg-blue-700 font-medium px-4 py-2 rounded-md transition-colors shadow-sm"
                        >
                            <UserCircleIcon className="h-5 w-5 mr-2" />
                            Sign In
                        </button>
                    )}

                    <button
                        onClick={onOpenSettings}
                        className="flex items-center text-gray-600 hover:text-gray-900 font-medium bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md transition-colors"
                        title="Settings"
                    >
                        <Cog6ToothIcon className="h-5 w-5 md:mr-2" />
                        <span className="hidden md:inline">Settings</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
