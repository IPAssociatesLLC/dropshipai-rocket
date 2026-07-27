'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { Users, Search, RefreshCw, Shield, UserCheck, UserX, Mail, Calendar, Crown } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
  plan: string;
  isActive: boolean;
  createdAt: string;
}

const PLAN_STYLES: Record<string, { bg: string; text: string }> = {
  trial: { bg: 'bg-secondary', text: 'text-muted-foreground' },
  starter: { bg: 'bg-info-subtle', text: 'text-info' },
  pro: { bg: 'bg-primary/10', text: 'text-primary' },
  enterprise: { bg: 'bg-positive-subtle', text: 'text-positive' },
};

function mapDbUser(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    email: row.email as string,
    fullName: (row.full_name as string) || '',
    role: row.role as 'admin' | 'user',
    plan: (row.plan as string) || 'trial',
    isActive: (row.is_active as boolean) ?? true,
    createdAt: row.created_at as string,
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.error('Users fetch error:', error.message); return; }
      setUsers((data || []).map(mapDbUser));
    } catch (err) {
      console.error('Users error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const updateUserPlan = async (userId: string, plan: string) => {
    setUpdatingId(userId);
    const supabase = createClient();
    await supabase.from('user_profiles').update({ plan }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u));
    setUpdatingId(null);
  };

  const toggleActive = async (user: UserProfile) => {
    setUpdatingId(user.id);
    const supabase = createClient();
    await supabase.from('user_profiles').update({ is_active: !user.isActive }).eq('id', user.id);
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !user.isActive } : u));
    setUpdatingId(null);
  };

  const filtered = users.filter(u => {
    const planMatch = planFilter === 'all' || u.plan === planFilter;
    const roleMatch = roleFilter === 'all' || u.role === roleFilter;
    const searchMatch = !searchQuery ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    return planMatch && roleMatch && searchMatch;
  });

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.isActive).length;
  const proUsers = users.filter(u => u.plan === 'pro' || u.plan === 'enterprise').length;
  const trialUsers = users.filter(u => u.plan === 'trial').length;

  return (
    <AppLayout title="Users" subtitle="Manage platform users and subscriptions">
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: totalUsers, icon: <Users size={16} />, color: 'bg-info-subtle text-info' },
            { label: 'Active Users', value: activeUsers, icon: <UserCheck size={16} />, color: 'bg-positive-subtle text-positive' },
            { label: 'Paid Plans', value: proUsers, icon: <Crown size={16} />, color: 'bg-primary/10 text-primary' },
            { label: 'On Trial', value: trialUsers, icon: <Shield size={16} />, color: 'bg-warning-subtle text-warning' },
          ].map((kpi) => (
            <div key={kpi.label} className="card-elevated p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
              </div>
              <p className="font-mono-data text-2xl font-bold text-foreground">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name or email..." className="input-base pl-8 h-8 text-xs w-full" />
          </div>
          <div className="flex items-center gap-1">
            {['all', 'trial', 'starter', 'pro', 'enterprise'].map(p => (
              <button key={p} onClick={() => setPlanFilter(p)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize ${planFilter === p ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'}`}>
                {p === 'all' ? 'All Plans' : p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {['all', 'admin', 'user'].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize ${roleFilter === r ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'}`}>
                {r === 'all' ? 'All Roles' : r}
              </button>
            ))}
          </div>
          <button onClick={fetchUsers} className="btn-secondary text-xs gap-1.5">
            <RefreshCw size={13} />Refresh
          </button>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="card-elevated py-16 flex items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-elevated py-16 flex flex-col items-center justify-center text-center">
            <Users size={32} className="text-muted-foreground mb-3" />
            <p className="text-base font-semibold text-foreground mb-1">No users found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}>
                    {['User', 'Role', 'Plan', 'Status', 'Joined', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user, i) => {
                    const planStyle = PLAN_STYLES[user.plan] || PLAN_STYLES.trial;
                    return (
                      <tr key={user.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
                        className="hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: 'var(--primary)' }}>
                              {(user.fullName || user.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{user.fullName || '—'}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail size={10} />{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground border border-border'}`}>
                            {user.role === 'admin' && <Shield size={10} />}{user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={user.plan}
                            onChange={e => updateUserPlan(user.id, e.target.value)}
                            disabled={updatingId === user.id}
                            className={`text-[10px] font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${planStyle.bg} ${planStyle.text}`}
                          >
                            {['trial', 'starter', 'pro', 'enterprise'].map(p => <option key={p} value={p} className="bg-white text-gray-900">{p}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${user.isActive ? 'bg-positive-subtle text-positive' : 'bg-negative-subtle text-negative'}`}>
                            {user.isActive ? <UserCheck size={10} /> : <UserX size={10} />}
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleActive(user)}
                            disabled={updatingId === user.id}
                            className={`text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${user.isActive ? 'border-negative/30 text-negative hover:bg-negative-subtle' : 'border-positive/30 text-positive hover:bg-positive-subtle'}`}
                          >
                            {updatingId === user.id ? <RefreshCw size={11} className="animate-spin" /> : user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
