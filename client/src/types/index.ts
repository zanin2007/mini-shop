export interface User {
  id: number;
  email: string;
  nickname: string;
}

export interface Product {
  id: number;
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
  user: {
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
  status: string;
  created_at: string;
  items?: OrderItem[];
}
