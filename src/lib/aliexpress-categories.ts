/**
 * Official AliExpress top-level Category ID / Name list.
 * Source: AliExpress Open Platform "Category ID / Name List" appendix (user-provided PDF, verified 2026-07-27).
 * Shared by the Product Discovery browse UI and the AliExpress search API route so both
 * always agree on which numeric category_id maps to which label.
 */

export interface AliCategory {
  id: string; // '' = All Categories (omit category_id param entirely)
  label: string;
}

export const ALIEXPRESS_CATEGORIES: AliCategory[] = [
  { id: '', label: 'All Categories' },
  { id: '13', label: 'Home Improvement' },
  { id: '15', label: 'Home & Garden' },
  { id: '18', label: 'Sports & Entertainment' },
  { id: '21', label: 'Office & School Supplies' },
  { id: '26', label: 'Toys & Hobbies' },
  { id: '30', label: 'Security & Protection' },
  { id: '34', label: 'Automobiles, Parts & Accessories' },
  { id: '36', label: 'Jewelry & Accessories' },
  { id: '39', label: 'Lights & Lighting' },
  { id: '44', label: 'Consumer Electronics' },
  { id: '66', label: 'Beauty & Health' },
  { id: '320', label: 'Weddings & Events' },
  { id: '322', label: 'Shoes' },
  { id: '502', label: 'Electronic Components & Supplies' },
  { id: '509', label: 'Phones & Telecommunications' },
  { id: '1420', label: 'Tools' },
  { id: '1501', label: 'Mother & Kids' },
  { id: '1503', label: 'Furniture' },
  { id: '1511', label: 'Watches' },
  { id: '1524', label: 'Luggage & Bags' },
  { id: '200000343', label: "Men's Clothing" },
  { id: '200000345', label: "Women's Clothing" },
  { id: '200000297', label: 'Apparel Accessories' },
  { id: '200000532', label: 'Novelty & Special Use' },
  { id: '200001075', label: 'Special Category' },
  { id: '200165144', label: 'Hair Extensions & Wigs' },
  { id: '200574005', label: 'Underwear' },
  { id: '201169612', label: 'Virtual Products' },
  { id: '201355758', label: 'Motorcycle Equipments & Parts' },
  { id: '201520802', label: 'Second-Hand' },
  { id: '201768104', label: 'Sports Shoes, Clothing & Accessories' },
];

export function categoryLabel(id: string | number | undefined | null): string | undefined {
  if (id === undefined || id === null || id === '') return undefined;
  return ALIEXPRESS_CATEGORIES.find((c) => c.id === String(id))?.label;
}
