import React from 'react';
import AppLayout from '@/components/AppLayout';
import OrdersContent from './components/OrdersContent';

export default function OrdersPage() {
  return (
    <AppLayout
      title="Orders"
      subtitle="Fulfillment tracking · Cashback routing · Shipment updates"
    >
      <OrdersContent />
    </AppLayout>
  );
}