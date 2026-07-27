'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { Activity, CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp, Search, Filter, ToggleLeft, ToggleRight, Zap, Package, Globe, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ActivityLog {
  id: string;
  type: 'scan' | 'import' | 'sync' | 'error' | 'api' | 'system';
  status: 'completed' | 'failed' | 'pending' | 'running';
  title: string;
  message: string;
  detail?: string;
  source?: string;
  productsCount?: number;
  opportunitiesCount?: number;
  duration?: string;
  errorCode?: string;
  stackTrace?: string;
  createdAt: string;
  completedAt?: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  scan: { label: 'Scan', color: '#818cf8', bg: 'rgba(99,102,241,0.1)', icon: <Zap size={12} /> },
  import: { label: 'Import', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: <Package size={12} /> },
  sync: { label: 'Sync', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: <RefreshCw size={12} /> },
  error: { label: 'Error', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: <XCircle size={12} /> },
  api: { label: 'API', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: <Globe size={12} /> },
  system: { label: 'System', color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: <Activity size={12} /> },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  completed: { label: 'Completed', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: <CheckCircle2 size={11} /> },
  failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: <XCircle size={11} /> },
  pending: { label: 'Pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: <Clock size={11} /> },
  running: { label: 'Running', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: <RefreshCw size={11} className="animate-spin" /> },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function timeDiff(start: string, end?: string): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

// Generate seed logs only when DB is completely empty (first load)
function generateSeedLogs(): ActivityLog[] {
  const now = Date.now();
  return [
    {
      id: 'seed-1',
      type: 'system',
      status: 'completed',
      title: 'Application Started',
      message: 'DropAutoAI dashboard loaded',
      source: 'System',
      createdAt: new Date(now - 86400000).toISOString(),
      completedAt: new Date(now - 86399000).toISOString(),
    },
  ];
}

export default function ActivityLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      if (!user) {
        setLogs(generateSeedLogs());
        setLoading(false);
        return;
      }

      const supabase = createClient();

      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.warn('activity_logs table not found, using seed logs:', error.message);
        setLogs(generateSeedLogs());
      } else {
        const mapped: ActivityLog[] = (data || []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          type: (row.type as ActivityLog['type']) || 'system',
          status: (row.status as ActivityLog['status']) || 'completed',
          title: (row.title as string) || 'Activity',
          message: (row.message as string) || '',
          detail: row.detail as string | undefined,
          source: row.source as string | undefined,
          productsCount: row.products_count as number | undefined,
          opportunitiesCount: row.opportunities_count as number | undefined,
          duration: row.duration as string | undefined,
          errorCode: row.error_code as string | undefined,
          stackTrace: row.stack_trace as string | undefined,
          createdAt: row.created_at as string,
          completedAt: row.completed_at as string | undefined,
        }));
        // Only show seed logs if DB is truly empty
        setLogs(mapped.length > 0 ? mapped : generateSeedLogs());
      }
    } catch (err) {
      console.error('Activity logs fetch error:', err);
      setLogs(generateSeedLogs());
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = logs.filter(log => {
    const statusMatch = statusFilter === 'all' || log.status === statusFilter;
    const typeMatch = typeFilter === 'all' || log.type === typeFilter;
    const searchMatch = !searchQuery ||
      log.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.errorCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.source || '').toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && typeMatch && searchMatch;
  });

  const totalScans = logs.filter(l => l.type === 'scan').length;
  const completed = logs.filter(l => l.status === 'completed').length;
  const failed = logs.filter(l => l.status === 'failed').length;
  const successRate = logs.length > 0 ? ((completed / logs.length) * 100).toFixed(1) : '0.0';

  return (
    <AppLayout title="Activity Logs" subtitle="Track all scans, imports, syncs, and system events">
      <div className="space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Events', value: logs.length, color: '#818cf8', icon: <Activity size={16} /> },
            { label: 'Completed', value: completed, color: '#10b981', icon: <CheckCircle2 size={16} /> },
            { label: 'Failed', value: failed, color: '#ef4444', icon: <XCircle size={16} /> },
            { label: 'Success Rate', value: `${successRate}%`, color: '#f59e0b', icon: <AlertTriangle size={16} /> },
          ].map((stat) => (
            <div key={stat.label} className="card-elevated px-4 py-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--card)', color: stat.color }}>
                  {stat.icon}
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="input-base pl-8 h-8 text-xs w-48"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter size={12} style={{ color: 'var(--muted-foreground)' }} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-base h-8 text-xs">
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
              </select>
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-base h-8 text-xs">
              <option value="all">All Types</option>
              <option value="scan">Scan</option>
              <option value="import">Import</option>
              <option value="sync">Sync</option>
              <option value="api">API</option>
              <option value="error">Error</option>
              <option value="system">System</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: autoRefresh ? '#10b981' : 'var(--muted-foreground)' }}
            >
              {autoRefresh ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              Auto-refresh
            </button>
            <button
              onClick={fetchLogs}
              className="btn-secondary text-xs gap-1.5"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* Logs table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="card-elevated h-14 animate-pulse" style={{ background: 'var(--card)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-elevated px-6 py-14 text-center">
            <Activity size={36} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>No activity logs found</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {logs.length === 0 ? 'Activity will appear here as you use the platform.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Table header */}
            <div className="hidden lg:grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)', gridTemplateColumns: '80px 1fr 110px 60px 60px 160px 120px 70px' }}>
              <div>Type</div>
              <div>Event</div>
              <div>Status</div>
              <div className="text-center">Products</div>
              <div className="text-center">Opps</div>
              <div>Error</div>
              <div>Started</div>
              <div className="text-center">Duration</div>
            </div>

            {filtered.map(log => {
              const typeCfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.system;
              const statusCfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.completed;
              const isExpanded = expandedIds.has(log.id);
              const hasDetail = !!(log.detail || log.errorCode || log.stackTrace);
              const duration = log.duration || timeDiff(log.createdAt, log.completedAt);

              return (
                <div
                  key={log.id}
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--card)', border: `1px solid ${log.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'var(--border)'}` }}
                >
                  {/* Row */}
                  <div
                    className={`px-4 py-3 ${hasDetail ? 'cursor-pointer hover:opacity-90' : ''}`}
                    onClick={() => hasDetail && toggleExpand(log.id)}
                  >
                    {/* Mobile */}
                    <div className="lg:hidden space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: typeCfg.bg, color: typeCfg.color }}>
                            {typeCfg.icon} {typeCfg.label}
                          </span>
                          <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{log.title}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                          {hasDetail && (isExpanded ? <ChevronUp size={13} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronDown size={13} style={{ color: 'var(--muted-foreground)' }} />)}
                        </div>
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{log.message}</p>
                      <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                        <span>{formatDate(log.createdAt)}</span>
                        {log.errorCode && <span style={{ color: '#ef4444' }}>Code: {log.errorCode}</span>}
                        {duration !== '—' && <span>{duration}</span>}
                      </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden lg:grid items-center gap-3" style={{ gridTemplateColumns: '80px 1fr 110px 60px 60px 160px 120px 70px' }}>
                      <div className="min-w-0">
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium w-fit" style={{ background: typeCfg.bg, color: typeCfg.color }}>
                          {typeCfg.icon} {typeCfg.label}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{log.title}</p>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{log.message}</p>
                      </div>
                      <div className="min-w-0">
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium w-fit" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{log.productsCount ?? '—'}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{log.opportunitiesCount ?? '—'}</span>
                      </div>
                      <div className="min-w-0">
                        {log.errorCode ? (
                          <span className="text-[10px] font-mono truncate block" style={{ color: '#ef4444' }} title={log.errorCode}>{log.errorCode}</span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>—</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{formatDate(log.createdAt)}</span>
                      </div>
                      <div className="text-center flex items-center justify-center gap-1">
                        <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{duration}</span>
                        {hasDetail && (isExpanded ? <ChevronUp size={12} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronDown size={12} style={{ color: 'var(--muted-foreground)' }} />)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && hasDetail && (
                    <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="pt-3 space-y-3">
                        {log.detail && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Details</p>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>{log.detail}</p>
                          </div>
                        )}
                        {log.errorCode && (
                          <div className="flex items-center gap-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Error Code</p>
                            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{log.errorCode}</span>
                          </div>
                        )}
                        {log.source && (
                          <div className="flex items-center gap-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Source</p>
                            <span className="text-xs" style={{ color: 'var(--foreground)' }}>{log.source}</span>
                          </div>
                        )}
                        {log.stackTrace && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Stack Trace</p>
                            <pre className="text-[10px] overflow-auto p-3 rounded-lg" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: '#ef4444', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '200px' }}>
                              {log.stackTrace}
                            </pre>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                          <span>Started: {formatDate(log.createdAt)}</span>
                          {log.completedAt && <span>Completed: {formatDate(log.completedAt)}</span>}
                          {duration !== '—' && <span>Duration: {duration}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
