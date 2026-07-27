export interface PendingProduct {
  id: string;
  title: string;
  image: string;
  imageAlt: string;
  source: 'aliexpress' | 'walmart' | 'rakuten' | 'topcashback' | string;
  sourceUrl: string;
  buyPrice: number;
  googleLowest?: number;
  googleLowestPrice?: number;
  margin: number;
  cashbackPct: number;
  cashbackSite: string;
  category: string;
  rating: number;
  reviewCount?: number;
  scrapedAt?: string;
  brand?: string;
  upc?: string;
  sku?: string;
  freeShipping?: boolean;
  giftReceipt?: boolean;
  shippingDays?: number;
  stock?: number;
  hasVariants?: boolean;
}

export interface ActiveListing {
  id: string;
  bonanzaId: string;
  bonanzaUrl?: string;
  title: string;
  image: string;
  imageAlt: string;
  source: 'aliexpress' | 'walmart' | 'rakuten' | 'topcashback' | string;
  sourceUrl?: string;
  buyPrice: number;
  listPrice: number;
  margin: number;
  cashbackPct: number;
  cashbackSite?: string;
  status: 'active' | 'paused' | 'price-alert' | 'stock-alert' | 'out-of-stock';
  lastChecked: string;
  soldCount: number;
  views: number;
  category?: string;
}

export const SOURCE_LABELS: Record<string, string> = {
  aliexpress: 'AliExpress',
  walmart: 'Walmart Flash',
  rakuten: 'Rakuten',
  topcashback: 'TopCashback'
};

export const SOURCE_COLORS: Record<string, string> = {
  aliexpress: 'bg-negative-subtle text-negative border border-negative/20',
  walmart: 'bg-info-subtle text-info border border-info/20',
  rakuten: 'bg-warning-subtle text-warning border border-warning/20',
  topcashback: 'bg-positive-subtle text-positive border border-positive/20'
};

export const pendingProducts: PendingProduct[] = [
{
  id: 'prod-001',
  title: 'Samsung 65W Super Fast Charger USB-C (EP-TA865)',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_115cf6121-1773066536258.png",
  imageAlt: 'Samsung 65W USB-C charger in white, compact brick form factor',
  source: 'walmart',
  sourceUrl: 'https://walmart.com/flash-deals/samsung-charger',
  buyPrice: 14.97,
  googleLowest: 34.99,
  margin: 52.2,
  cashbackPct: 6.5,
  cashbackSite: 'TopCashback',
  category: 'Electronics',
  rating: 4.7,
  reviewCount: 2841,
  scrapedAt: '14 min ago'
},
{
  id: 'prod-002',
  title: 'Xiaomi Mi Smart Scale 2 Body Composition Bluetooth',
  image: "https://images.unsplash.com/photo-1619410801513-dfb019c4763f",
  imageAlt: 'White Xiaomi smart scale on bathroom floor with smartphone app display',
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/xiaomi-scale-2',
  buyPrice: 18.40,
  googleLowest: 39.99,
  margin: 47.1,
  cashbackPct: 8.0,
  cashbackSite: 'Rakuten',
  category: 'Health',
  rating: 4.6,
  reviewCount: 15420,
  scrapedAt: '22 min ago'
},
{
  id: 'prod-003',
  title: 'Baseus 100W USB-C Cable 6-Pack Braided Nylon 2m',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_15ecef6a8-1778253499093.png",
  imageAlt: 'Bundle of braided USB-C cables in various colors on white surface',
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/baseus-cable-6pk',
  buyPrice: 11.20,
  googleLowest: 24.99,
  margin: 44.2,
  cashbackPct: 8.0,
  cashbackSite: 'Rakuten',
  category: 'Electronics',
  rating: 4.5,
  reviewCount: 8920,
  scrapedAt: '38 min ago'
},
{
  id: 'prod-004',
  title: 'UGREEN 6-in-1 USB-C Hub Docking Station 4K HDMI',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_18b1b69da-1773347660020.png",
  imageAlt: 'Silver USB-C hub with multiple ports connected to laptop',
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/ugreen-hub-6in1',
  buyPrice: 19.50,
  googleLowest: 44.99,
  margin: 43.8,
  cashbackPct: 8.0,
  cashbackSite: 'Rakuten',
  category: 'Electronics',
  rating: 4.8,
  reviewCount: 6741,
  scrapedAt: '1h 05m ago'
},
{
  id: 'prod-005',
  title: 'Govee LED Strip Lights 10m RGBIC Smart WiFi App',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_19975f2c8-1772547681200.png",
  imageAlt: 'Colorful LED strip lights illuminating a room with purple and pink glow',
  source: 'walmart',
  sourceUrl: 'https://walmart.com/flash-deals/govee-led',
  buyPrice: 12.50,
  googleLowest: 27.99,
  margin: 40.9,
  cashbackPct: 6.5,
  cashbackSite: 'TopCashback',
  category: 'Smart Home',
  rating: 4.4,
  reviewCount: 12300,
  scrapedAt: '1h 22m ago'
},
{
  id: 'prod-006',
  title: 'Anker Nano Charger 30W USB-C PD PPS GaN',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_136296a58-1775963538856.png",
  imageAlt: 'Compact black Anker GaN charger plugged into wall outlet',
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/anker-nano-30w',
  buyPrice: 9.80,
  googleLowest: 21.99,
  margin: 38.7,
  cashbackPct: 8.0,
  cashbackSite: 'Rakuten',
  category: 'Electronics',
  rating: 4.9,
  reviewCount: 31200,
  scrapedAt: '2h 11m ago'
},
{
  id: 'prod-007',
  title: 'QCY T13 True Wireless Earbuds Bluetooth 5.1 28h',
  image: "https://images.unsplash.com/photo-1606741965359-946075e4d550",
  imageAlt: 'White wireless earbuds in open charging case on gray background',
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/qcy-t13',
  buyPrice: 13.70,
  googleLowest: 29.99,
  margin: 35.1,
  cashbackPct: 8.0,
  cashbackSite: 'Rakuten',
  category: 'Audio',
  rating: 4.3,
  reviewCount: 44800,
  scrapedAt: '3h 04m ago'
},
{
  id: 'prod-008',
  title: 'UGREEN MagSafe Compatible Phone Mount Car Vent',
  image: "https://images.unsplash.com/photo-1729067218696-90ef6f67840c",
  imageAlt: 'Black magnetic phone mount attached to car air vent with iPhone mounted',
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/ugreen-magsafe-mount',
  buyPrice: 8.20,
  googleLowest: 17.99,
  margin: 31.4,
  cashbackPct: 8.0,
  cashbackSite: 'Rakuten',
  category: 'Automotive',
  rating: 4.6,
  reviewCount: 9870,
  scrapedAt: '4h 30m ago'
}];


export const activeListings: ActiveListing[] = [
{
  id: 'lst-001',
  bonanzaId: 'BNZ-9201',
  title: 'Xiaomi Mi Smart Scale 2 Body Composition',
  image: "https://images.unsplash.com/photo-1709062803702-962cec60e5b2",
  imageAlt: 'White Xiaomi smart scale',
  source: 'aliexpress',
  buyPrice: 18.40,
  listPrice: 38.99,
  margin: 47.1,
  cashbackPct: 8.0,
  status: 'active',
  lastChecked: '8 min ago',
  soldCount: 12,
  views: 341,
  category: 'Health'
},
{
  id: 'lst-002',
  bonanzaId: 'BNZ-9188',
  title: 'Baseus 100W USB-C Cable 6-Pack Braided',
  image: "https://images.unsplash.com/photo-1633315921943-c4c12f35db16",
  imageAlt: 'Bundle of braided USB-C cables',
  source: 'aliexpress',
  buyPrice: 11.20,
  listPrice: 23.99,
  margin: 44.2,
  cashbackPct: 8.0,
  status: 'active',
  lastChecked: '12 min ago',
  soldCount: 28,
  views: 892,
  category: 'Electronics'
},
{
  id: 'lst-003',
  bonanzaId: 'BNZ-8841',
  title: 'Anker PowerBank 26800mAh USB-C PD 30W',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1755c6330-1772683639940.png",
  imageAlt: 'Black Anker portable power bank',
  source: 'aliexpress',
  buyPrice: 29.28,
  listPrice: 52.99,
  margin: 11.0,
  cashbackPct: 8.0,
  status: 'price-alert',
  lastChecked: '11 min ago',
  soldCount: 7,
  views: 224,
  category: 'Electronics'
},
{
  id: 'lst-004',
  bonanzaId: 'BNZ-8820',
  title: 'UGREEN MagSafe Phone Mount Car Vent',
  image: "https://images.unsplash.com/photo-1729067427232-eb5cb974aa8e",
  imageAlt: 'Black magnetic car phone mount',
  source: 'aliexpress',
  buyPrice: 8.07,
  listPrice: 17.99,
  margin: 28.0,
  cashbackPct: 8.0,
  status: 'price-alert',
  lastChecked: '11 min ago',
  soldCount: 34,
  views: 1102,
  category: 'Automotive'
},
{
  id: 'lst-005',
  bonanzaId: 'BNZ-8793',
  title: 'Baseus USB-C Hub 7-in-1 4K HDMI',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_18b1b69da-1773347660020.png",
  imageAlt: 'Silver USB-C hub with multiple ports',
  source: 'aliexpress',
  buyPrice: 19.50,
  listPrice: 44.99,
  margin: 43.8,
  cashbackPct: 8.0,
  status: 'stock-alert',
  lastChecked: '2h 03m ago',
  soldCount: 19,
  views: 567,
  category: 'Electronics'
},
{
  id: 'lst-006',
  bonanzaId: 'BNZ-8755',
  title: 'QCY T13 True Wireless Earbuds Bluetooth',
  image: "https://images.unsplash.com/photo-1612622837671-5a94ceef08f2",
  imageAlt: 'White wireless earbuds in charging case',
  source: 'aliexpress',
  buyPrice: 13.70,
  listPrice: 28.99,
  margin: 35.1,
  cashbackPct: 8.0,
  status: 'active',
  lastChecked: '15 min ago',
  soldCount: 44,
  views: 1489,
  category: 'Audio'
},
{
  id: 'lst-007',
  bonanzaId: 'BNZ-8740',
  title: 'Govee LED Strip Lights 10m RGBIC Smart',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1d395ca6a-1773142967434.png",
  imageAlt: 'Colorful LED strip lights in room',
  source: 'walmart',
  buyPrice: 12.50,
  listPrice: 26.99,
  margin: 40.9,
  cashbackPct: 6.5,
  status: 'active',
  lastChecked: '20 min ago',
  soldCount: 31,
  views: 988,
  category: 'Smart Home'
},
{
  id: 'lst-008',
  bonanzaId: 'BNZ-8712',
  title: 'Samsung 65W Super Fast Charger USB-C',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_115cf6121-1773066536258.png",
  imageAlt: 'Samsung 65W USB-C charger white',
  source: 'walmart',
  buyPrice: 14.97,
  listPrice: 33.99,
  margin: 52.2,
  cashbackPct: 6.5,
  status: 'active',
  lastChecked: '8 min ago',
  soldCount: 58,
  views: 2104,
  category: 'Electronics'
},
{
  id: 'lst-009',
  bonanzaId: 'BNZ-8698',
  title: 'Anker Nano Charger 30W USB-C PD GaN',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_136296a58-1775963538856.png",
  imageAlt: 'Compact black Anker GaN charger',
  source: 'aliexpress',
  buyPrice: 9.80,
  listPrice: 21.49,
  margin: 38.7,
  cashbackPct: 8.0,
  status: 'active',
  lastChecked: '18 min ago',
  soldCount: 67,
  views: 2891,
  category: 'Electronics'
},
{
  id: 'lst-010',
  bonanzaId: 'BNZ-8650',
  title: 'UGREEN USB-C 6-in-1 Hub 4K HDMI 100W PD',
  image: "https://images.unsplash.com/photo-1675082145420-57f461df46b9",
  imageAlt: 'Silver multi-port USB-C hub on desk',
  source: 'aliexpress',
  buyPrice: 19.50,
  listPrice: 44.00,
  margin: 43.8,
  cashbackPct: 8.0,
  status: 'paused',
  lastChecked: '1h 45m ago',
  soldCount: 23,
  views: 744,
  category: 'Electronics'
}];