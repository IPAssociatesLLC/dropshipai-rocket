import React from 'react';
import { ShoppingCart, Clock, Truck, DollarSign } from 'lucide-react';
import { Order } from './ordersData';

interface OrderKPICardsProps {
  orders?: Order[];
}

const stateStyles: Record<string, { card: string; icon: string; value: string }> = {
  positive: { card: 'card-elevated', icon: 'bg-positive-subtle text-positive', value: 'text-foreground' },
  warning: { card: 'card-elevated border-warning/20', icon: 'bg-warning-subtle text-warning', value: 'text-warning' },
  info: { card: 'card-elevated', icon: 'bg-info-subtle text-info', value: 'text-foreground' },
};

export default function OrderKPICards({ orders = [] }: OrderKPICardsProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ordersToday = orders.filter(o => new Date(o.createdAt || o.placedAt || '') >= today).length;
  const pendingRouting = orders.filter(o => o.status === 'cashback-routing').length;
  const inTransit = orders.filter(o => o.status === 'shipped').length;
  const cashbackTotal = orders.reduce((sum, o) => sum + (o.cashbackEarned || 0), 0);

  const kpis = [
    { id: 'okpi-today', label: 'Orders Today', value: String(ordersToday), sub: `${pendingRouting} need routing action`, icon: <ShoppingCart size={16} />, state: 'info' },
    { id: 'okpi-routing', label: 'Pending Routing', value: String(pendingRouting), sub: 'Awaiting cashback confirmation', icon: <Clock size={16} />, state: 'warning' },
    { id: 'okpi-transit', label: 'In Transit', value: String(inTransit), sub: 'Shipped, awaiting delivery', icon: <Truck size={16} />, state: 'positive' },
    { id: 'okpi-cashback', label: 'Cashback Earned', value: `$${cashbackTotal.toFixed(2)}`, sub: `Across ${orders.length} orders`, icon: <DollarSign size={16} />, state: 'positive' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => {
        const s = stateStyles[kpi.state] || stateStyles.info;
        return (
          <div key={kpi.id} className={`${s.card} p-5`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.icon}`}>{kpi.icon}</div>
            </div>
            <p className={`font-mono-data text-2xl font-bold mb-1 ${s.value}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.sub}</p>
          </div>
        );
      })}
    </div>
  );
}