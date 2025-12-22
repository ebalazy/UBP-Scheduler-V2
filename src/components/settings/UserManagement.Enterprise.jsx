import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase/client';
import * as AdminService from '../../services/supabase/admin';
import { UserPlusIcon, TrashIcon, ShieldCheckIcon, ClipboardDocumentIcon, InformationCircleIcon, PlusIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';

const ROLES = [
    {
        id: 'admin',
        label: 'Administrator',
        badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
        desc: 'Full system access. Can manage users, settings, and master data.'
    },
    {
        id: 'planner',
        label: 'Lead Planner',
        badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        desc: 'Can edit Master Schedule, MRP, and Production Plans.'
    },
    {
        id: 'logistics',
        label: 'Floor / Logistics',
        badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
        desc: 'Can manage Trucks, Verify Shifts, and view Schedule. No MRP editing.'
    },
    {
        id: 'viewer',
        label: 'Read-Only Viewer',
        badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
        desc: 'Can view dashboards and schedules but cannot make changes.'
    }
];

export default function UserManagementEnterprise() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('viewer');
    const [error, setError] = useState(null);
    const [showSqlHelp, setShowSqlHelp] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await AdminService.fetchAllUserRoles();
            setUsers(data);
            setShowSqlHelp(false);
        } catch (err) {
            console.error(err);
            if (err.code === '42P01' || err.message?.includes('Could not find the table')) {
                setShowSqlHelp(true);
                setUsers([]);
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // --- ENTERPRISE PROVISIONING LOGIC ---
    // Uses Supabase Edge Function 'invite-user' via AdminService
    const provisionUser = async (e) => {
        e.preventDefault();
        if (!newUserEmail) return;

        setLoading(true);
        setError(null);

        try {
            // Call the Backend Function via Service
            await AdminService.inviteUserEnterprise(newUserEmail, newUserRole);

            // Success UI
            alert(`Invitation sent to ${newUserEmail}!\n\nThey will receive an email from Supabase to set their password.`);

            setNewUserEmail('');
            fetchUsers(); // Refresh list

        } catch (err) {
            console.error("Provisioning Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (email) => {
        if (!confirm(`Revoke access for ${email}?`)) return;
        try {
            await AdminService.deleteUserRole(email);
            setUsers(users.filter(u => u.email !== email));
        } catch (err) {
            setError(err.message);
        }
    };

    const handleUpdateRole = async (email, newRole) => {
        try {
            // Optimistic Update
            setUsers(users.map(u => u.email === email ? { ...u, role: newRole } : u));
            await AdminService.updateUserRole(email, newRole);
        } catch (err) {
            setError(err.message);
            fetchUsers(); // Revert
        }
    };

    if (showSqlHelp) {
        return (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                <p>SQL Setup Required (Same as standard)</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <CloudArrowUpIcon className="w-6 h-6 text-blue-500" />
                Enterprise User Management
            </h2>

            {/* Use Provisioning Form: "Invite User" */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <UserPlusIcon className="w-5 h-5 text-blue-500" /> Invite Team Member
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                    Send an official invitation email via the secure backend.
                </p>

                <form onSubmit={provisionUser} className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">User Email</label>
                        <input
                            type="email"
                            required
                            placeholder="colleague@company.com"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2.5 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        />
                    </div>
                    <div className="w-full sm:w-48">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Role</label>
                        <select
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value)}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2.5 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        >
                            {ROLES.map(role => (
                                <option key={role.id} value={role.id}>{role.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full sm:w-auto">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? 'Sending...' : (
                                <>
                                    <PlusIcon className="w-5 h-5" />
                                    <span>Send Invite</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* List (Reused UI logic) */}
            <div>
                <div className="flex justify-between items-end mb-3">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Authorized Users ({users.length})</h3>
                </div>
                {error && <div className="mb-4 text-rose-500 text-sm bg-rose-50 dark:bg-rose-900/20 p-2 rounded border border-rose-100 dark:border-rose-800">{error}</div>}

                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700 shadow-sm overflow-hidden">
                    {users.map(u => (
                        <div key={u.id || u.email} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 gap-3">
                            <div className="flex-1">
                                <div className="text-sm font-bold text-slate-900 dark:text-white">{u.email}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <select
                                    value={u.role}
                                    onChange={(e) => handleUpdateRole(u.email, e.target.value)}
                                    className="text-xs rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white py-1.5 px-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {ROLES.map(role => (
                                        <option key={role.id} value={role.id}>{role.label}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => handleDeleteUser(u.email)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                    title="Revoke Access"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
