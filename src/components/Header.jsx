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
        </header >
    );
}
