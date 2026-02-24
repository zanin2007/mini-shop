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
  delivery_address: string;
  receiver_name: string;
  receiver_phone: string;
  status: string;
  created_at: string;
  items?: OrderItem[];
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
