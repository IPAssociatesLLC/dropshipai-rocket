'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import KPIBentoGrid from './KPIBentoGrid';
import ActivityFeed from './ActivityFeed';
import AlertsPanel from './AlertsPanel';
import MiniOrderQueue from './MiniOrderQueue';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';

const ScrapeVolumeChart = dynamic(() => import('./ScrapeVolumeChart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={240} />,
});

const MarginDistributionChart = dynamic(() => import('./MarginDistributionChart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={220} />,
});

const SourceBreakdownChart = dynamic(() => import('./SourceBreakdownChart'), {
  ssr: false,
  loading: () => <ChartSkeleton height={220} />,
});

export default function DashboardContent() {
  return (
    <div className="space-y-6">
      {/* KPI Bento Grid */}
      <KPIBentoGrid />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2">
          <ScrapeVolumeChart />
        </div>
        <div className="lg:col-span-1 flex flex-col">
          <SourceBreakdownChart />
        </div>
      </div>

      {/* Margin distribution + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-4">
        <MarginDistributionChart />
        <div id="alerts-panel">
          <AlertsPanel />
        </div>
      </div>

      {/* Activity + Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-4">
        <ActivityFeed />
        <MiniOrderQueue />
      </div>
    </div>
  );
}