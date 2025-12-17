import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase/client';
import * as AdminService from '../../services/supabase/admin';
import DuplicateCleaner from './DuplicateCleaner';
import {
    UserPlusIcon,
    PlusIcon,
    TrashIcon,
    ShieldCheckIcon,
    ClipboardDocumentIcon
} from '@heroicons/react/24/outline';

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

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('viewer');
    const [error, setError] = useState(null);
    const [createdUser, setCreatedUser] = useState(null); // {email, password}
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

    // --- PROVISIONING LOGIC ---
    // Uses a temporary client to sign up users directly (server-side simulation)
    const provisionUser = async (e) => {
        e.preventDefault();
        if (!newUserEmail) return;

        setLoading(true);
        setError(null);

        // 1. Generate Simple Temp Password (10 chars, alphanumeric)
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const passwordValues = new Uint32Array(10);
        crypto.getRandomValues(passwordValues);
        let tempPassword = "";
        for (let i = 0; i < 10; i++) {
            tempPassword += charset[passwordValues[i] % charset.length];
        }

        try {
            // 2. Sign Up the User (Client Side Hack via Service)
            try {
                await AdminService.provisionUserClientSide(newUserEmail, tempPassword);
            } catch (authError) {
                if (authError.message?.includes('Signups not allowed')) {
                    throw new Error("Cannot create user: Public Signups are disabled. Enable them or use Enterprise Invite.");
                }
                throw authError;
            }

            // 3. Add to User Roles
            await AdminService.upsertUserRole(newUserEmail, newUserRole);

            // 4. Update Local State
            setUsers(prev => [
                { email: newUserEmail.toLowerCase(), role: newUserRole, created_at: new Date().toISOString() },
                ...prev.filter(u => u.email !== newUserEmail.toLowerCase())
            ]);

            // 5. Show Success Modal
            setCreatedUser({ email: newUserEmail, password: tempPassword });
            setNewUserEmail('');

        } catch (err) {
            console.error("Provisioning Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
            fetchUsers(); // Refresh to be safe
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
                <h3 className="font-bold text-amber-800 dark:text-amber-200 mb-2">Setup Required</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                    The <code>user_roles</code> table is missing. Run this SQL in your Supabase SQL Editor:
                </p>
                <div className="bg-slate-900 rounded p-4 relative group">
                    <code className="text-xs text-green-400 font-mono block whitespace-pre-wrap">
                        {`create table user_roles (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  role text default 'viewer',
  created_at timestamptz default now()
);

alter table user_roles enable row level security;
create policy "Allow read access for all auth users" on user_roles for select to authenticated using (true);
create policy "Allow insert/update/delete for authenticated" on user_roles for all to authenticated using (true); 
-- In production, replace the write policy with: using (auth.email() IN (SELECT email FROM user_roles WHERE role = 'admin'))`}
                    </code>
                    <button
                        onClick={() => navigator.clipboard.writeText(`create table user_roles ( id uuid default gen_random_uuid() primary key, email text unique not null, role text default 'viewer', created_at timestamptz default now() ); alter table user_roles enable row level security; create policy "Allow read access" on user_roles for select to authenticated using (true); create policy "Allow all write" on user_roles for all to authenticated using (true);`)}
                        className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                    >
                        <ClipboardDocumentIcon className="w-3 h-3" /> Copy
                    </button>
                </div>
                <div className="mt-4 flex gap-2">
                    <button onClick={fetchUsers} className="px-4 py-2 bg-amber-200 hover:bg-amber-300 rounded text-amber-900 font-bold text-sm">
                        I've ran the SQL, Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 relative">
            <DuplicateCleaner />

            {/* SUCCESS MODAL FOR NEW USER */}
            {createdUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden transform scale-100 transition-all">
                        <div className="bg-emerald-500 h-2 w-full"></div>
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-full">
                                    <ShieldCheckIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">User Created!</h3>
                            </div>

                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                The account for <strong className="text-slate-700 dark:text-slate-200">{createdUser.email}</strong> is ready. Please copy the temporary password below.
                            </p>

                            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Temporary Password</label>
                                <div className="flex items-center gap-2">
                                    <code className="text-lg font-mono font-bold text-slate-800 dark:text-emerald-400 break-all">
                                        {createdUser.password}
                                    </code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(createdUser.password);
                                            alert("Password Copied!");
                                        }}
                                        className="ml-auto p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                        title="Copy Password"
                                    >
                                        <ClipboardDocumentIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => setCreatedUser(null)}
                                className="w-full bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Roles Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map(role => (
                    <div key={role.id} className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shrink-0 mt-0.5 ${role.badge}`}>
                            {role.label}
                        </span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                            {role.desc}
                        </p>
                    </div>
                ))}
            </div>

            {/* Use Provisioning Form: "Create User" */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <UserPlusIcon className="w-5 h-5 text-blue-500" /> Provision New User
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                    Instantly create a user account. The system will generate a temporary password for you to give to them.
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
                            {loading ? 'Processing...' : (
                                <>
                                    <PlusIcon className="w-5 h-5" />
                                    <span>Create User</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* List */}
            <div>
                <div className="flex justify-between items-end mb-3">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Authorized Users ({users.length})</h3>
                </div>

                {error && <div className="mb-4 text-rose-500 text-sm bg-rose-50 dark:bg-rose-900/20 p-2 rounded border border-rose-100 dark:border-rose-800">{error}</div>}

                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500 animate-pulse text-sm">Loading users...</div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm italic">No users found. Create one above.</div>
                    ) : (
                        users.map(u => {
                            const roleConfig = ROLES.find(r => r.id === u.role) || ROLES[3];
                            return (
                                <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 ring-2 ring-white dark:ring-slate-800 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 uppercase shadow-sm">
                                            {u.email.substring(0, 2)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{u.email}</div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                Added {new Date(u.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pl-14 sm:pl-0">
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleUpdateRole(u.email, e.target.value)}
                                            className={`text-xs font-bold rounded-full py-1.5 px-3 border-0 cursor-pointer focus:ring-2 focus:ring-offset-1 transition-colors outline-none ${roleConfig.badge}`}
                                        >
                                            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                        </select>

                                        <button
                                            title="Revoke Access"
                                            onClick={() => handleDeleteUser(u.email)}
                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
