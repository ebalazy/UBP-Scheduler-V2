import { Truck, Boxes, CalendarClock, Menu, X, Crown, Package, Upload } from 'lucide-react';
import { useState } from 'react';

export default function MobileBottomNav({ activeTab, setActiveTab, userRole }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const showPlanning = ['admin', 'planner'].includes(userRole || 'admin');

    const NavItem = ({ id, label, icon: Icon, activeColor }) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => {
                    setActiveTab(id);
                    setIsMenuOpen(false); // Close menu if clicking main item
                }}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? activeColor : 'text-slate-400 dark:text-slate-500'}`}
            >
                <Icon className={`w-6 h-6 ${isActive ? 'fill-current opacity-20' : ''} absolute transform scale-150 transition-opacity`} />
                <Icon className={`w-6 h-6 z-10 ${isActive ? 'scale-110' : ''}`} />
                <span className="text-[10px] font-bold">{label}</span>
            </button>
        );
    };

    return (
        <>
            {/* BOTTOM BAR SPACER (Prevents content being hidden) */}
            <div className="h-20 lg:hidden block" />

            {/* FLOATING ACTION MENU (Secondary Items) */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden flex flex-col justify-end pb-24 px-4 animation-delay-100"
                    onClick={() => setIsMenuOpen(false)}
                >
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-up space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 px-2">More Options</h3>

                        <button
                            onClick={() => { setActiveTab('master'); setIsMenuOpen(false); }}
                            className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                        >
                            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                <Crown className="w-5 h-5" />
                            </div>
                            <span className="font-bold">Master Plan</span>
                        </button>
                    </div>
                </div>
            )}

            {/* FIXED BOTTOM NAV */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 h-20 shadow-2xl lg:hidden pb-safe">
                <div className="grid grid-cols-4 h-full items-center">

                    {/* 1. PLAN (Primary for Planners) */}
                    {showPlanning ? (
                        <NavItem
                            id="plan"
                            label="Plan"
                            icon={Boxes}
                            activeColor="text-blue-600 dark:text-blue-400"
                        />
                    ) : (
                        <div className="text-center opacity-20">
                            <Boxes className="w-6 h-6 mx-auto" />
                        </div>
                    )}

                    {/* 2. SCHEDULE */}
                    <NavItem
                        id="schedule"
                        label="Schedule"
                        icon={CalendarClock}
                        activeColor="text-purple-600 dark:text-purple-400"
                    />

                    {/* 3. OPERATIONS */}
                    <NavItem
                        id="operations"
                        label="Ops"
                        icon={Truck}
                        activeColor="text-emerald-600 dark:text-emerald-400"
                    />

                    {/* 4. Menu (More) */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isMenuOpen ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                        {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        <span className="text-[10px] font-bold">Menu</span>
                    </button>

                </div>
            </nav>
        </>
    );
}
