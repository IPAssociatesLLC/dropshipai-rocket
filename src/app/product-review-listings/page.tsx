import React from 'react';
import AppLayout from '@/components/AppLayout';
import ProductReviewContent from './components/ProductReviewContent';

export default function ProductReviewPage() {
  return (
    <AppLayout
      title="Product Review & Listings"
      subtitle="Review profitable products · Manage Bonanza listings"
    >
      <ProductReviewContent />
    </AppLayout>
  );
}