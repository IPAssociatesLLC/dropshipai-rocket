import React from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardContent from './components/DashboardContent';

export default function DashboardPage() {
  return (
    <AppLayout
      title="Pipeline Dashboard"
      subtitle="DropAutoAI · Live monitoring"
    >
      <DashboardContent />
    </AppLayout>
  );
}