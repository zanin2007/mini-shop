export interface User {
  id: number;
  email: string;
  nickname: string;
  role?: string;
  points?: number;
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
  options?: ProductOption[];
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
  options?: CartItemOption[];
}

export interface Order {
  id: number;
  user_id: number;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  coupon_id: number | null;
  points_used?: number;
  delivery_address: string;
  receiver_name: string;
  receiver_phone: string;
  status: string;
  created_at: string;
  completed_at?: string;
  items?: OrderItem[];
  is_gift?: boolean;
}

export interface Refund {
  id: number;
  order_id: number;
  user_id: number;
  reason: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface ProductOption {
  id: number;
  product_id: number;
  option_name: string;
  values: ProductOptionValue[];
}

export interface ProductOptionValue {
  id: number;
  option_id: number;
  value: string;
  extra_price: number;
  stock: number;
}

export interface CartItemOption {
  option_value_id: number;
  option_name: string;
  value: string;
  extra_price: number;
  option_stock?: number;
}

export interface CartPageItem {
  id: number;
  product_id: number;
  quantity: number;
  is_selected: boolean;
  name: string;
  price: number;
  image_url: string;
  stock: number;
  options?: CartItemOption[];
}

export interface SearchedUser {
  id: number;
  nickname: string;
}

export interface Gift {
  id: number;
  order_id: number;
  sender_id: number;
  receiver_id: number | null;
  sender_nickname?: string;
  receiver_nickname?: string;
  receiver_name: string;
  receiver_phone: string;
  message: string;
  status: string;
  accepted_at: string | null;
  created_at: string;
  order_items?: OrderItem[];
  total_amount?: number;
  final_amount?: number;
  order_status?: string;
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

export interface Announcement {
  id: number;
  admin_id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  type: string;
  reward_type: string | null;
  reward_id: number | null;
  reward_amount: number | null;
  max_participants: number | null;
  current_participants?: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_participated?: boolean;
  created_at: string;
}
