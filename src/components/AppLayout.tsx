'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AIAgentPanel from './AIAgentPanel';

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sidebar panel */}
          <div className="relative z-10 flex-shrink-0">
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onMobileClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          title={title}
          subtitle={subtitle}
          onMobileMenuOpen={() => setMobileOpen(true)}
          onAIAgentOpen={() => setAiPanelOpen(true)}
        />
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--background)' }}>
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 xl:px-8 2xl:px-10 py-6">
            {children}
          </div>
        </main>
      </div>

      {/* AI Agent Panel */}
      {aiPanelOpen && (
        <AIAgentPanel onClose={() => setAiPanelOpen(false)} />
      )}
    </div>
  );
}