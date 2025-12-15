import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { UserPlusIcon, TrashIcon, ShieldCheckIcon, ClipboardDocumentIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

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
    const [showSqlHelp, setShowSqlHelp] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('user_roles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01' || error.message?.includes('Could not find the table')) { // undefined_table or schema cache error
                    setShowSqlHelp(true);
                    setUsers([]);
                    return;
                }
                throw error;
            }
            setUsers(data || []);
            setShowSqlHelp(false);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            setError(null);
            const { data, error } = await supabase.from('user_roles').insert([
                { email: newUserEmail.toLowerCase(), role: newUserRole }
            ]).select();

            if (error) throw error;
            setUsers([data[0], ...users]);
            setNewUserEmail('');
            alert(`User '${newUserEmail}' authorized! Now go to Supabase Dashboard to send them an Invite.`);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteUser = async (email) => {
        if (!confirm(`Revoke access for ${email}?`)) return;
        try {
            const { error } = await supabase.from('user_roles').delete().match({ email });
            if (error) throw error;
            setUsers(users.filter(u => u.email !== email));
        } catch (err) {
            setError(err.message);
        }
    };

    const handleUpdateRole = async (email, newRole) => {
        try {
            // Optimistic Update
            setUsers(users.map(u => u.email === email ? { ...u, role: newRole } : u));

            const { error } = await supabase.from('user_roles').update({ role: newRole }).match({ email });
            if (error) {
                fetchUsers();
                throw error;
            }
        } catch (err) {
            setError(err.message);
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
        <div className="space-y-8">
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

            {/* Add User Form */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheckIcon className="w-4 h-4" /> Pre-Authorize User
                </h3>
                <p className="text-xs text-slate-500 mb-4 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 flex items-start gap-2">
                    <InformationCircleIcon className="w-5 h-5 shrink-0" />
                    <span>
                        <strong>Two-Step Account Creation:</strong><br />
                        1. Add the user's email and role below to authorize access.<br />
                        2. Go to your <strong>Supabase Dashboard &gt; Authentication</strong> and click "Invite User" to send them a password setup link.
                    </span>
                </p>
                <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="email"
                        required
                        placeholder="new.user@email.com"
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                        className="flex-1 rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value)}
                        className="rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm font-medium focus:ring-2 focus:ring-blue-500"
                    >
                        {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 sm:py-0 flex items-center justify-center font-bold text-sm shadow-sm transition-transform active:scale-95"
                    >
                        <UserPlusIcon className="w-5 h-5 mr-2 sm:mr-0" />
                        <span className="sm:hidden">Add User</span>
                    </button>
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
                        <div className="p-8 text-center text-slate-400 text-sm italic">No users found. Add one above.</div>
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
