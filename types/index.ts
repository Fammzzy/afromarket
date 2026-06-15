export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  phone_number?: string | null;
  location?: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  stock_quantity: number;
  image_url?: string | null;
  status: 'active' | 'inactive' | 'draft';
  tags: string[];
  location: string;
  created_at: string;
  updated_at: string;
  seller?: User;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  created_at: string;
}

export interface Cart {
  id: string;
  user_id: string;
  created_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product?: Product;
}

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  total_amount: number;
  order_status: OrderStatus;
  payment_status: 'pending_delivery' | 'paid_on_delivery';
  delivery_address: string;
  delivery_phone: string;
  delivery_notes: string;
  created_at: string;
  updated_at: string;
  buyer?: User;
  seller?: User;
  order_items?: OrderItem[];
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  product?: Product;
}

export interface SalesAnalytics {
  id: string;
  seller_id: string;
  month: string;
  total_sales: number;
  revenue: number;
  created_at: string;
  updated_at: string;
}

export interface AIPrediction {
  id: string;
  seller_id: string;
  prediction_type: string;
  prediction_data: Record<string, unknown>;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SavedProduct {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  product?: Product;
}

export const PRODUCT_CATEGORIES = [
  'Fruits & Vegetables',
  'Grains & Cereals',
  'Dairy & Eggs',
  'Meat & Poultry',
  'Fish & Seafood',
  'Herbs & Spices',
  'Nuts & Seeds',
  'Honey & Sweeteners',
  'Oils & Fats',
  'Beverages',
  'Processed Foods',
  'Other',
] as const;

export const PRODUCT_UNITS = [
  'kg',
  'g',
  'lb',
  'oz',
  'piece',
  'bunch',
  'crate',
  'bag',
  'litre',
  'dozen',
  'tray',
  'cup',
  'basket',
] as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-orange-100 text-orange-800',
  out_for_delivery: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};
