export interface User {
  id: number;
  email: string;
  nickname: string;
  role?: string;
}

export interface Product {
  id: number;
  user_id: number | null;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  stock: number;
  created_at: string;
}

export interface CartItem {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  product: Product;
}

export interface Wishlist {
  id: number;
  user_id: number;
  product_id: number;
  product: Product;
}

export interface Review {
  id: number;
  user_id: number;
  product_id: number;
  content: string;
  rating: number;
  created_at: string;
  nickname?: string;
  user?: {
    nickname: string;
  };
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  price: number;
  name: string;
  image_url: string;
}

export interface Order {
  id: number;
  user_id: number;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  coupon_id: number | null;
  delivery_address: string;
  receiver_name: string;
  receiver_phone: string;
  status: string;
  created_at: string;
  items?: OrderItem[];
}

export interface Coupon {
  user_coupon_id: number;
  coupon_id: number;
  code: string;
  discount_amount: number;
  discount_percentage: number | null;
  min_price: number | null;
  expiry_date: string;
  calculated_discount: number;
}

export interface UserCoupon {
  id: number;
  coupon_id: number;
  code: string;
  discount_amount: number;
  discount_percentage: number | null;
  min_price: number | null;
  expiry_date: string;
  is_used: boolean;
  used_at: string | null;
  claimed_at: string;
  is_active: boolean;
}
