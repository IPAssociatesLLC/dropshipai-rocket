import React from 'react';

type BadgeVariant = 'active' | 'pending' | 'alert' | 'info' | 'muted' | 'warning';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  active: 'status-badge-active',
  pending: 'status-badge-pending',
  alert: 'status-badge-alert',
  info: 'status-badge-info',
  muted: 'status-badge-muted',
  warning: 'status-badge-pending',
};

export default function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={`${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}