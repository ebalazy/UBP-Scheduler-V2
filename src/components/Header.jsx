import { useState, useEffect } from 'react';
import { Cog6ToothIcon, ArrowRightOnRectangleIcon, PrinterIcon, CloudIcon } from '@heroicons/react/24/outline';
import { Truck, Boxes, CalendarClock, Crown, Package, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './auth/AuthModal';
import ubpLogo from '../assets/ubp_logo_v4.png';

export default function Header({ onOpenSettings, isSaving, saveError, activeTab, setActiveTab }) {
    const { user, userRole, signOut } = useAuth();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [scrolled, setScrolled] = useState(false);

    const showPlanning = ['admin', 'planner'].includes(userRole || 'admin');

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Premium Nav Item
    const NavItem = ({ id, label, icon: Icon, activeColor }) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`
                    relative group flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all duration-300
                    ${isActive
                        ? 'bg-white text-slate-900 shadow-md ring-1 ring-black/5 dark:bg-slate-700 dark:text-white dark:ring-white/10'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
                    }
                `}
            >
                <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110 ' + activeColor : 'group-hover:scale-110 opacity-70 group-hover:opacity-100'}`} />
                <span>{label}</span>
                {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-900 dark:bg-white opacity-20"></span>
                )}
            </button>
        );
    };

    return (
        <>
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

            {/* Premium Floating Header */}
            <header className={`
                sticky top-0 z-50 w-full transition-all duration-500 ease-in-out border-b
                ${scrolled
                    ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 shadow-sm py-2'
                    : 'bg-white dark:bg-slate-900 border-transparent py-4'
                }
            `}>
                <div className="max-w-[1920px] mx-auto px-6 flex justify-between items-center">

                    {/* 1. LEFT: Brand Identity */}
                    {/* 1. LEFT: Brand Identity */}
                    <div className="flex items-center gap-4 w-[280px]">
                        <div className={`
                            relative h-11 w-11 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 
                            shadow-lg shadow-slate-900/20 dark:shadow-white/10
                            flex items-center justify-center overflow-hidden transition-transform hover:scale-105 duration-300
                            ${scrolled ? 'ring-2 ring-white dark:ring-slate-800' : ''}
                        `}>
                            {/* Inner Gloss */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>

                            <img src={ubpLogo} alt="UBP" className="h-[85%] w-[85%] object-contain drop-shadow-md z-10" />
                        </div>

                        <div className="flex flex-col justify-center">
                            <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white leading-none font-display">
                                UBP <span className="text-slate-400 font-medium">Scheduler</span>
                            </h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm tracking-wide">
                                    V3
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Enterprise
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 2. CENTER: Premium Navigation Pill */}
                    {user && (
                        <nav className={`
                            hidden lg:flex items-center p-1.5 rounded-full transition-all duration-300
                            ${scrolled
                                ? 'bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md shadow-inner border border-white/20 dark:border-slate-700/50'
                                : 'bg-slate-50 dark:bg-slate-800/30'
                            }
                        `}>

                            {/* 1. PLAN (MRP) */}
                            {showPlanning && (
                                <NavItem
                                    id="plan"
                                    label="Plan"
                                    icon={Boxes}
                                    activeColor="text-blue-500"
                                />
                            )}

                            {/* 2. MAKE (Scheduler) */}
                            {showPlanning && (
                                <NavItem
                                    id="schedule"
                                    label="Schedule"
                                    icon={CalendarClock}
                                    activeColor="text-purple-500"
                                />
                            )}

                            {/* Dividers if needed */}
                            {showPlanning && <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-2 opacity-50"></div>}

                            {/* 3. MOVE (Logistics/Operations) */}
                            <NavItem
                                id="operations"
                                label="Operations"
                                icon={Truck}
                                activeColor="text-emerald-500"
                            />
                        </nav>
                    )}

                    {/* 3. RIGHT: Actions & Profile */}
                    <div className="flex items-center justify-end gap-5 w-[280px]">

                        {/* Status Indicators */}
                        {user && (
                            <div className="flex items-center gap-3">
                                <div className={`
                                    flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-colors
                                    ${isSaving
                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                        : saveError
                                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                                            : isOnline
                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                    }
                                `} title={saveError || (isOnline ? "Online & Synced" : "Offline")}>
                                    <CloudIcon className={`h-3.5 w-3.5 ${isSaving ? 'animate-bounce' : ''}`} />
                                    <span className="hidden xl:inline">{isSaving ? 'Saving...' : saveError ? 'Error' : 'Synced'}</span>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            {/* Print Button */}
                            <button
                                onClick={() => window.print()}
                                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                                title="Print View"
                            >
                                <PrinterIcon className="h-5 w-5" />
                            </button>

                            {/* Settings Button */}
                            <button
                                onClick={onOpenSettings}
                                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all group"
                                title="Settings"
                            >
                                <Cog6ToothIcon className="h-5 w-5 group-hover:rotate-180 transition-transform duration-700" />
                            </button>
                        </div>

                        {/* User Profile */}
                        {user ? (
                            <div className="flex items-center pl-5 border-l border-slate-200 dark:border-slate-800">
                                <button
                                    onClick={signOut}
                                    className="flex items-center gap-3 group pl-2"
                                    title="Click to Sign Out"
                                >
                                    <div className="text-right hidden xl:block">
                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-rose-500 transition-colors">
                                            {user.email?.split('@')[0]}
                                        </div>
                                        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest group-hover:text-rose-400 transition-colors">
                                            {userRole || 'User'}
                                        </div>
                                    </div>
                                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-xs font-bold text-white group-hover:ring-rose-500 transition-all">
                                        {user.email?.[0].toUpperCase()}
                                    </div>
                                    <ArrowRightOnRectangleIcon className="w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors xl:hidden" />
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => setIsAuthModalOpen(true)} className="px-5 py-2 rounded-full bg-slate-900 text-white text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all dark:bg-white dark:text-slate-900">
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
}
