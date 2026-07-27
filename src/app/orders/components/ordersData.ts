export type OrderStatus =
'received' | 'cashback-routing' | 'ordering' | 'ordered' | 'shipped' | 'delivered' | 'completed' | 'exception';

export type OrderSource = 'aliexpress' | 'walmart' | 'rakuten' | 'topcashback' | 'befrugal' | 'swagbucks' | 'ibotta';

export interface Order {
  id: string;
  bonanzaOrderId: string;
  product: string;
  productImage?: string;
  productImageAlt?: string;
  buyer: string;
  buyerEmail?: string;
  salePrice?: number;
  sellPrice?: number;
  buyPrice: number;
  margin: number;
  cashbackSite: string;
  cashbackPct: number;
  cashbackEarned: number;
  source: OrderSource | string;
  sourceUrl: string;
  sourceOrderId?: string;
  status: OrderStatus;
  trackingNumber: string;
  carrier: string;
  giftReceipt?: boolean;
  placedAt?: string;
  createdAt?: string;
  shippedAt: string;
  estimatedDelivery?: string;
  deliveredAt: string;
  notes?: string;
  timeline?: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
  status: 'completed' | 'active' | 'pending';
}

export const STATUS_CONFIG: Record<OrderStatus, {label: string;cls: string;}> = {
  received: { label: 'Received', cls: 'status-badge-info' },
  'cashback-routing': { label: 'Routing', cls: 'status-badge-pending' },
  ordering: { label: 'Ordering', cls: 'status-badge-pending' },
  ordered: { label: 'Ordered', cls: 'status-badge-info' },
  shipped: { label: 'Shipped', cls: 'status-badge-active' },
  delivered: { label: 'Delivered', cls: 'status-badge-active' },
  completed: { label: 'Completed', cls: 'status-badge-active' },
  exception: { label: 'Exception', cls: 'status-badge-alert' }
};

export const SOURCE_LABELS: Record<string, string> = {
  aliexpress: 'AliExpress',
  walmart: 'Walmart',
  rakuten: 'Rakuten',
  topcashback: 'TopCashback',
  befrugal: 'BeFrugal',
  swagbucks: 'Swagbucks',
  ibotta: 'Ibotta',
};

export const SOURCE_COLORS: Record<string, string> = {
  aliexpress: 'bg-negative-subtle text-negative border border-negative/20',
  walmart: 'bg-info-subtle text-info border border-info/20',
  rakuten: 'bg-warning-subtle text-warning border border-warning/20',
  topcashback: 'bg-positive-subtle text-positive border border-positive/20',
  befrugal: 'bg-positive-subtle text-positive border border-positive/20',
  swagbucks: 'bg-warning-subtle text-warning border border-warning/20',
  ibotta: 'bg-info-subtle text-info border border-info/20',
};

export const mockOrders: Order[] = [
{
  id: 'ord-4484',
  bonanzaOrderId: 'BNZ-ORD-88221',
  product: 'Xiaomi Mi Smart Scale 2',
  productImage: "https://images.unsplash.com/photo-1709062803702-962cec60e5b2",
  productImageAlt: 'White Xiaomi smart scale',
  buyer: 'Marcus Thornton',
  buyerEmail: 'm.thornton@gmail.com',
  salePrice: 38.99,
  buyPrice: 18.40,
  margin: 44.1,
  cashbackSite: 'Rakuten',
  cashbackPct: 8.0,
  cashbackEarned: 1.47,
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/xiaomi-scale-2',
  sourceOrderId: '',
  status: 'cashback-routing',
  trackingNumber: '',
  carrier: '',
  giftReceipt: true,
  placedAt: 'Jul 22, 2:29 PM',
  shippedAt: '',
  estimatedDelivery: 'Jul 29–Aug 2',
  deliveredAt: '',
  timeline: [
  { id: 'tl-1', label: 'Order received on Bonanza', detail: 'BNZ-ORD-88221 · $38.99', timestamp: 'Jul 22, 2:29 PM', status: 'completed' },
  { id: 'tl-2', label: 'Routing through Rakuten cashback', detail: '8% cashback — est. $1.47 savings', timestamp: 'Jul 22, 2:31 PM', status: 'active' },
  { id: 'tl-3', label: 'Place order at AliExpress', detail: 'Pending cashback confirmation', timestamp: '', status: 'pending' },
  { id: 'tl-4', label: 'Ship to customer with gift receipt', detail: '', timestamp: '', status: 'pending' },
  { id: 'tl-5', label: 'Delivery confirmation', detail: '', timestamp: '', status: 'pending' }]
},
{
  id: 'ord-4483',
  bonanzaOrderId: 'BNZ-ORD-88219',
  product: 'Baseus 100W USB-C Cable 6-Pack',
  productImage: "https://images.unsplash.com/photo-1633315921943-c4c12f35db16",
  productImageAlt: 'Bundle of braided USB-C cables',
  buyer: 'Priya Nambiar',
  buyerEmail: 'priya.nambiar@outlook.com',
  salePrice: 22.50,
  buyPrice: 11.20,
  margin: 39.2,
  cashbackSite: 'Rakuten',
  cashbackPct: 8.0,
  cashbackEarned: 0.90,
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/baseus-cable-6pk',
  sourceOrderId: '',
  status: 'cashback-routing',
  trackingNumber: '',
  carrier: '',
  giftReceipt: true,
  placedAt: 'Jul 22, 2:06 PM',
  shippedAt: '',
  estimatedDelivery: 'Jul 29–Aug 2',
  deliveredAt: '',
  timeline: [
  { id: 'tl-1', label: 'Order received on Bonanza', detail: 'BNZ-ORD-88219 · $22.50', timestamp: 'Jul 22, 2:06 PM', status: 'completed' },
  { id: 'tl-2', label: 'Routing through Rakuten cashback', detail: '8% cashback — est. $0.90 savings', timestamp: 'Jul 22, 2:08 PM', status: 'active' },
  { id: 'tl-3', label: 'Place order at AliExpress', detail: '', timestamp: '', status: 'pending' },
  { id: 'tl-4', label: 'Ship to customer with gift receipt', detail: '', timestamp: '', status: 'pending' },
  { id: 'tl-5', label: 'Delivery confirmation', detail: '', timestamp: '', status: 'pending' }]
},
{
  id: 'ord-4482',
  bonanzaOrderId: 'BNZ-ORD-88214',
  product: 'Anker Nano Charger 30W USB-C GaN',
  productImage: "https://img.rocket.new/generatedImages/rocket_gen_img_136296a58-1775963538856.png",
  productImageAlt: 'Compact black Anker GaN charger',
  buyer: 'Devon Kalani',
  buyerEmail: 'dkalani@icloud.com',
  salePrice: 31.00,
  buyPrice: 9.80,
  margin: 37.4,
  cashbackSite: 'Rakuten',
  cashbackPct: 8.0,
  cashbackEarned: 0.78,
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/anker-nano-30w',
  sourceOrderId: 'AE-77841920',
  status: 'ordering',
  trackingNumber: '',
  carrier: 'AliExpress Standard',
  giftReceipt: true,
  placedAt: 'Jul 22, 12:58 PM',
  shippedAt: '',
  estimatedDelivery: 'Jul 29–Aug 2',
  deliveredAt: '',
  timeline: [
  { id: 'tl-1', label: 'Order received on Bonanza', detail: 'BNZ-ORD-88214 · $31.00', timestamp: 'Jul 22, 12:58 PM', status: 'completed' },
  { id: 'tl-2', label: 'Routed through Rakuten', detail: '8% cashback confirmed · $0.78', timestamp: 'Jul 22, 1:01 PM', status: 'completed' },
  { id: 'tl-3', label: 'Placing order at AliExpress', detail: 'AE-77841920 · Processing', timestamp: 'Jul 22, 1:04 PM', status: 'active' },
  { id: 'tl-4', label: 'Ship to customer with gift receipt', detail: '', timestamp: '', status: 'pending' },
  { id: 'tl-5', label: 'Delivery confirmation', detail: '', timestamp: '', status: 'pending' }]
},
{
  id: 'ord-4481',
  bonanzaOrderId: 'BNZ-ORD-88208',
  product: 'UGREEN USB-C Hub 6-in-1 4K HDMI',
  productImage: "https://img.rocket.new/generatedImages/rocket_gen_img_18b1b69da-1773347660020.png",
  productImageAlt: 'Silver USB-C hub with multiple ports',
  buyer: 'Sofia Reyes',
  buyerEmail: 's.reyes@yahoo.com',
  salePrice: 45.00,
  buyPrice: 19.50,
  margin: 51.1,
  cashbackSite: 'Rakuten',
  cashbackPct: 8.0,
  cashbackEarned: 1.56,
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/ugreen-hub-6in1',
  sourceOrderId: 'AE-77838014',
  status: 'shipped',
  trackingNumber: 'LX847291048CN',
  carrier: 'AliExpress Standard',
  giftReceipt: true,
  placedAt: 'Jul 22, 10:14 AM',
  shippedAt: 'Jul 22, 3:20 PM',
  estimatedDelivery: 'Jul 29–Aug 1',
  deliveredAt: '',
  timeline: [
  { id: 'tl-1', label: 'Order received on Bonanza', detail: 'BNZ-ORD-88208 · $45.00', timestamp: 'Jul 22, 10:14 AM', status: 'completed' },
  { id: 'tl-2', label: 'Routed through Rakuten', detail: '8% cashback confirmed · $1.56', timestamp: 'Jul 22, 10:17 AM', status: 'completed' },
  { id: 'tl-3', label: 'Order placed at AliExpress', detail: 'AE-77838014 · Gift receipt set', timestamp: 'Jul 22, 10:21 AM', status: 'completed' },
  { id: 'tl-4', label: 'Shipped to customer', detail: 'LX847291048CN · AliExpress Standard', timestamp: 'Jul 22, 3:20 PM', status: 'active' },
  { id: 'tl-5', label: 'Delivery confirmation', detail: 'Est. Jul 29–Aug 1', timestamp: '', status: 'pending' }]
},
{
  id: 'ord-4480',
  bonanzaOrderId: 'BNZ-ORD-88199',
  product: 'Samsung 65W Super Fast Charger',
  productImage: "https://img.rocket.new/generatedImages/rocket_gen_img_115cf6121-1773066536258.png",
  productImageAlt: 'Samsung 65W USB-C charger white',
  buyer: 'Liam Okafor',
  buyerEmail: 'l.okafor@gmail.com',
  salePrice: 33.99,
  buyPrice: 14.97,
  margin: 52.2,
  cashbackSite: 'TopCashback',
  cashbackPct: 6.5,
  cashbackEarned: 0.97,
  source: 'walmart',
  sourceUrl: 'https://walmart.com/flash-deals/samsung-charger',
  sourceOrderId: 'WM-5529017',
  status: 'shipped',
  trackingNumber: '1Z999AA10123456784',
  carrier: 'UPS',
  giftReceipt: true,
  placedAt: 'Jul 21, 4:44 PM',
  shippedAt: 'Jul 21, 6:10 PM',
  estimatedDelivery: 'Jul 24–25',
  deliveredAt: '',
  timeline: [
  { id: 'tl-1', label: 'Order received on Bonanza', detail: 'BNZ-ORD-88199 · $33.99', timestamp: 'Jul 21, 4:44 PM', status: 'completed' },
  { id: 'tl-2', label: 'Routed through TopCashback', detail: '6.5% cashback confirmed · $0.97', timestamp: 'Jul 21, 4:47 PM', status: 'completed' },
  { id: 'tl-3', label: 'Order placed at Walmart', detail: 'WM-5529017 · Gift receipt set', timestamp: 'Jul 21, 4:51 PM', status: 'completed' },
  { id: 'tl-4', label: 'Shipped via UPS', detail: '1Z999AA10123456784', timestamp: 'Jul 21, 6:10 PM', status: 'active' },
  { id: 'tl-5', label: 'Delivery confirmation', detail: 'Est. Jul 24–25', timestamp: '', status: 'pending' }]
},
{
  id: 'ord-4479',
  bonanzaOrderId: 'BNZ-ORD-88187',
  product: 'Govee LED Strip Lights 10m RGBIC',
  productImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1d395ca6a-1773142967434.png",
  productImageAlt: 'Colorful LED strip lights in room',
  buyer: 'Amara Osei',
  buyerEmail: 'amara.osei@hotmail.com',
  salePrice: 26.99,
  buyPrice: 12.50,
  margin: 40.9,
  cashbackSite: 'TopCashback',
  cashbackPct: 6.5,
  cashbackEarned: 0.81,
  source: 'walmart',
  sourceUrl: 'https://walmart.com/flash-deals/govee-led',
  sourceOrderId: 'WM-5528441',
  status: 'delivered',
  trackingNumber: '9400111899223397221817',
  carrier: 'USPS',
  giftReceipt: true,
  placedAt: 'Jul 20, 11:22 AM',
  shippedAt: 'Jul 20, 2:15 PM',
  estimatedDelivery: 'Jul 22–23',
  deliveredAt: 'Jul 22, 10:41 AM',
  timeline: [
  { id: 'tl-1', label: 'Order received on Bonanza', detail: 'BNZ-ORD-88187 · $26.99', timestamp: 'Jul 20, 11:22 AM', status: 'completed' },
  { id: 'tl-2', label: 'Routed through TopCashback', detail: '6.5% cashback confirmed · $0.81', timestamp: 'Jul 20, 11:25 AM', status: 'completed' },
  { id: 'tl-3', label: 'Order placed at Walmart', detail: 'WM-5528441 · Gift receipt set', timestamp: 'Jul 20, 11:29 AM', status: 'completed' },
  { id: 'tl-4', label: 'Shipped via USPS', detail: '9400111899223397221817', timestamp: 'Jul 20, 2:15 PM', status: 'completed' },
  { id: 'tl-5', label: 'Delivered to customer', detail: 'Jul 22, 10:41 AM', timestamp: 'Jul 22, 10:41 AM', status: 'completed' }]
},
{
  id: 'ord-4478',
  bonanzaOrderId: 'BNZ-ORD-88174',
  product: 'QCY T13 True Wireless Earbuds',
  productImage: "https://images.unsplash.com/photo-1612622837671-5a94ceef08f2",
  productImageAlt: 'White wireless earbuds in charging case',
  buyer: 'Tyler Brennan',
  buyerEmail: 't.brennan@gmail.com',
  salePrice: 28.99,
  buyPrice: 13.70,
  margin: 35.1,
  cashbackSite: 'Rakuten',
  cashbackPct: 8.0,
  cashbackEarned: 1.10,
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/qcy-t13',
  sourceOrderId: 'AE-77811002',
  status: 'completed',
  trackingNumber: 'LX811024019CN',
  carrier: 'AliExpress Standard',
  giftReceipt: true,
  placedAt: 'Jul 18, 9:05 AM',
  shippedAt: 'Jul 18, 2:40 PM',
  estimatedDelivery: 'Jul 25–27',
  deliveredAt: 'Jul 21, 3:18 PM',
  timeline: [
  { id: 'tl-1', label: 'Order received on Bonanza', detail: 'BNZ-ORD-88174 · $28.99', timestamp: 'Jul 18, 9:05 AM', status: 'completed' },
  { id: 'tl-2', label: 'Routed through Rakuten', detail: '8% cashback confirmed · $1.10', timestamp: 'Jul 18, 9:08 AM', status: 'completed' },
  { id: 'tl-3', label: 'Order placed at AliExpress', detail: 'AE-77811002 · Gift receipt set', timestamp: 'Jul 18, 9:12 AM', status: 'completed' },
  { id: 'tl-4', label: 'Shipped via AliExpress Standard', detail: 'LX811024019CN', timestamp: 'Jul 18, 2:40 PM', status: 'completed' },
  { id: 'tl-5', label: 'Delivered to customer', detail: 'Jul 21, 3:18 PM', timestamp: 'Jul 21, 3:18 PM', status: 'completed' }]
},
{
  id: 'ord-4477',
  bonanzaOrderId: 'BNZ-ORD-88160',
  product: 'UGREEN MagSafe Phone Mount Car',
  productImage: "https://images.unsplash.com/photo-1729067427232-eb5cb974aa8e",
  productImageAlt: 'Black magnetic car phone mount',
  buyer: 'Nadia Petrov',
  buyerEmail: 'nadia.p@yahoo.com',
  salePrice: 17.99,
  buyPrice: 8.07,
  margin: 28.0,
  cashbackSite: 'Rakuten',
  cashbackPct: 8.0,
  cashbackEarned: 0.65,
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/ugreen-magsafe-mount',
  sourceOrderId: 'AE-77801889',
  status: 'exception',
  trackingNumber: 'LX799021044CN',
  carrier: 'AliExpress Standard',
  giftReceipt: true,
  placedAt: 'Jul 17, 3:20 PM',
  shippedAt: 'Jul 18, 9:00 AM',
  estimatedDelivery: 'Jul 24–26',
  deliveredAt: '',
  timeline: [
  { id: 'tl-1', label: 'Order received on Bonanza', detail: 'BNZ-ORD-88160 · $17.99', timestamp: 'Jul 17, 3:20 PM', status: 'completed' },
  { id: 'tl-2', label: 'Routed through Rakuten', detail: '8% cashback confirmed · $0.65', timestamp: 'Jul 17, 3:22 PM', status: 'completed' },
  { id: 'tl-3', label: 'Order placed at AliExpress', detail: 'AE-77801889 · Gift receipt set', timestamp: 'Jul 17, 3:26 PM', status: 'completed' },
  { id: 'tl-4', label: 'Shipped via AliExpress Standard', detail: 'LX799021044CN', timestamp: 'Jul 18, 9:00 AM', status: 'completed' },
  { id: 'tl-5', label: 'Delivery exception — address issue', detail: 'Carrier attempted delivery, no access', timestamp: 'Jul 21, 11:30 AM', status: 'active' }]
},
{
  id: 'ord-4476',
  bonanzaOrderId: 'BNZ-ORD-88144',
  product: 'Anker PowerBank 26800mAh USB-C',
  productImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1755c6330-1772683639940.png",
  productImageAlt: 'Black Anker portable power bank',
  buyer: 'Carlos Mendez',
  buyerEmail: 'c.mendez@gmail.com',
  salePrice: 52.99,
  buyPrice: 29.28,
  margin: 11.0,
  cashbackSite: 'Rakuten',
  cashbackPct: 8.0,
  cashbackEarned: 2.34,
  source: 'aliexpress',
  sourceUrl: 'https://aliexpress.com/item/anker-powerbank-26800',
  sourceOrderId: 'AE-77788920',
  status: 'completed',
  trackingNumber: 'LX788012091CN',
  carrier: 'AliExpress Standard',
  giftReceipt: true,
  placedAt: 'Jul 16, 1:11 PM',
  shippedAt: 'Jul 16, 5:00 PM',
  estimatedDelivery: 'Jul 23–25',
  deliveredAt: 'Jul 22, 2:07 PM',
  timeline: [
  { id: 'tl-1', label: 'Order received on Bonanza', detail: 'BNZ-ORD-88144 · $52.99', timestamp: 'Jul 16, 1:11 PM', status: 'completed' },
  { id: 'tl-2', label: 'Routed through Rakuten', detail: '8% cashback confirmed · $2.34', timestamp: 'Jul 16, 1:14 PM', status: 'completed' },
  { id: 'tl-3', label: 'Order placed at AliExpress', detail: 'AE-77788920 · Gift receipt set', timestamp: 'Jul 16, 1:18 PM', status: 'completed' },
  { id: 'tl-4', label: 'Shipped via AliExpress Standard', detail: 'LX788012091CN', timestamp: 'Jul 16, 5:00 PM', status: 'completed' },
  { id: 'tl-5', label: 'Delivered to customer', detail: 'Jul 22, 2:07 PM', timestamp: 'Jul 22, 2:07 PM', status: 'completed' }]
},
{
  id: 'ord-4475',
  bonanzaOrderId: 'BNZ-ORD-88131',
  product: 'Baseus USB-C Hub 7-in-1 4K HDMI',
  productImage: "https://images.unsplash.com/photo-1675082145420-57f461df46b9",
  productImageAlt: 'Silver USB-C hub on desk',
  buyer: 'Yuki Tanaka',
  buyerEmail: 'yuki.tanaka@icloud.com',
  salePrice: 44.99,
  buyPrice: 19.50,
  margin: 43.8,
  cashbackSite: 'BeFrugal',
  cashbackPct: 7.5,
  cashbackEarned: 1.46,
  source: 'befrugal',
  sourceUrl: 'https://befrugal.com/deals/baseus-hub',
  sourceOrderId: 'BF-77775001',
  status: 'completed',
  trackingNumber: 'LX775004110CN',
  carrier: 'AliExpress Standard',
  giftReceipt: true,
  placedAt: 'Jul 15, 8:33 AM',
  shippedAt: 'Jul 15, 3:44 PM',
  estimatedDelivery: 'Jul 22–24',
  deliveredAt: 'Jul 21, 4:55 PM',
  timeline: [
  { id: 'tl-1', label: 'Order received on Bonanza', detail: 'BNZ-ORD-88131 · $44.99', timestamp: 'Jul 15, 8:33 AM', status: 'completed' },
  { id: 'tl-2', label: 'Routed through BeFrugal', detail: '7.5% cashback confirmed · $1.46', timestamp: 'Jul 15, 8:36 AM', status: 'completed' },
  { id: 'tl-3', label: 'Order placed via BeFrugal', detail: 'BF-77775001 · Gift receipt set', timestamp: 'Jul 15, 8:40 AM', status: 'completed' },
  { id: 'tl-4', label: 'Shipped via AliExpress Standard', detail: 'LX775004110CN', timestamp: 'Jul 15, 3:44 PM', status: 'completed' },
  { id: 'tl-5', label: 'Delivered to customer', detail: 'Jul 21, 4:55 PM', timestamp: 'Jul 21, 4:55 PM', status: 'completed' }]
}];