import { useState, useEffect } from 'react';
import { Cog6ToothIcon, UserCircleIcon, ArrowRightOnRectangleIcon, PrinterIcon, CloudIcon } from '@heroicons/react/24/outline';
import { Truck, Boxes, CalendarClock, Crown, Package, Gauge } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './auth/AuthModal';
import ubpLogo from '../assets/ubp_logo_v4.png';

export default function Header({ onOpenSettings, isSaving, saveError, activeTab, setActiveTab }) {
    const { user, userRole, signOut } = useAuth();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Redefine showPlanning here or accept as prop? Easier creating local derived state since we have userRole
    const showPlanning = ['admin', 'planner'].includes(userRole || 'admin');

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

    // Navigation Item Helper
    const NavItem = ({ id, label, icon: Icon, colorClass, activeClass }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`relative flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 group ${activeTab === id
                ? `bg-slate-100 dark:bg-slate-800 ${activeClass} shadow-sm ring-1 ring-black/5 dark:ring-white/10`
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
        >
            <Icon className={`w-3.5 h-3.5 transition-transform ${activeTab === id ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span>{label}</span>
            {activeTab === id && <div className={`absolute inset-0 rounded-lg ring-1 ring-inset ${colorClass} opacity-20`}></div>}
        </button>
    );

    return (
        <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm relative z-30 transition-colors duration-200 sticky top-0">
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

            <div className="max-w-[1920px] mx-auto px-4 lg:px-6 h-16 flex justify-between items-center gap-4">
                {/* 1. LEFT: Logo Section (Fixed Width) */}
                <div className="flex items-center gap-3 w-[240px] flex-shrink-0">
                    <div className="h-9 w-9 bg-white rounded-full shadow-md shadow-blue-500/10 ring-1 ring-slate-100 dark:ring-0 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform">
                        <img src={ubpLogo} alt="UBP" className="h-[90%] w-[90%] object-contain" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                            Beverage <span className="opacity-90 font-light text-slate-600 dark:text-slate-300">Scheduler</span>
                        </h1>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest opacity-80 scale-90 origin-left">
                            Co-Packer Edition
                        </p>
                    </div>
                </div>

                {/* 2. CENTER: Navigation (Flexible) */}
                {user && (
                    <div className="hidden md:flex flex-1 mx-4">
                        <nav className="flex w-full items-center p-1 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl gap-1 shadow-inner">

                            <NavItem
                                id="logistics"
                                label="Floor Ops"
                                icon={Truck} // Need to import icons
                                activeClass="text-emerald-600 dark:text-emerald-400"
                                colorClass="ring-emerald-500"
                            />

                            {showPlanning && (
                                <>
                                    <NavItem
                                        id="mrp"
                                        label="Materials"
                                        icon={Boxes}
                                        activeClass="text-blue-600 dark:text-blue-400"
                                        colorClass="ring-blue-500"
                                    />
                                    <NavItem
                                        id="scheduler"
                                        label="Scheduler"
                                        icon={CalendarClock}
                                        activeClass="text-purple-600 dark:text-purple-400"
                                        colorClass="ring-purple-500"
                                    />
                                    <NavItem
                                        id="master"
                                        label="Master Plan"
                                        icon={Crown}
                                        activeClass="text-amber-600 dark:text-amber-400"
                                        colorClass="ring-amber-500"
                                    />
                                </>
                            )}

                            <NavItem
                                id="products"
                                label="Products"
                                icon={Package}
                                activeClass="text-emerald-600 dark:text-emerald-400"
                                colorClass="ring-emerald-500"
                            />

                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                            <button
                                onClick={() => setActiveTab('cockpit')}
                                className={`relative flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 group ${activeTab === 'cockpit'
                                    ? 'bg-slate-800 text-white shadow-md ring-1 ring-black/10'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                            >
                                <Gauge className={`w-3.5 h-3.5 transition-transform ${activeTab === 'cockpit' ? 'scale-110' : 'group-hover:scale-110'}`} />
                                <span>Cockpit</span>
                                {activeTab !== 'cockpit' && (
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse ml-0.5"></span>
                                )}
                            </button>
                        </nav>
                    </div>
                )}

                {/* 3. RIGHT: Global Actions (Fixed Width to match Left) */}
                <div className="flex items-center justify-end gap-3 w-[240px] flex-shrink-0">

                    {/* Sync (Compact) */}
                    {user && (
                        <div className="flex items-center" title={saveError || "Cloud Synced"}>
                            <CloudIcon className={`h-4 w-4 ${isSaving ? 'text-blue-500 animate-pulse' : saveError ? 'text-rose-500' : isOnline ? 'text-emerald-500' : 'text-slate-400'}`} />
                        </div>
                    )}

                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

                    {/* Tools */}
                    <div className="flex items-center gap-1">
                        <button onClick={() => window.print()} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors" title="Print View">
                            <PrinterIcon className="h-4 w-4" />
                        </button>
                        <button onClick={onOpenSettings} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors group" title="Settings">
                            <Cog6ToothIcon className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                        </button>
                    </div>

                    {/* Profile */}
                    {user ? (
                        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                            <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-700 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                {user.email?.[0].toUpperCase()}
                            </div>
                            <button onClick={signOut} className="text-slate-400 hover:text-rose-500 transition-colors" title="Sign Out">
                                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setIsAuthModalOpen(true)} className="text-sm font-bold text-blue-600 hover:text-blue-700">
                            Sign In
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
// Add Icon imports at top of file separately via another tool call if needed or include in replacement logic?
// I need to add icon imports. Let's do that in a separate edit or include imports in the replacement if I can target the top validly.
// Better to just add the imports at the top first.
