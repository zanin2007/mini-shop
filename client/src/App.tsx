import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AlertProvider } from './components/AlertContext';
import Layout from './components/Layout';
import MainPage from './pages/Main/MainPage';
import './App.css';

// 지연 로딩: 초기 번들에서 분리
const LoginPage = lazy(() => import('./pages/Auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/Auth/SignupPage'));
const ProductDetailPage = lazy(() => import('./pages/Product/ProductDetailPage'));
const ProductRegisterPage = lazy(() => import('./pages/Product/ProductRegisterPage'));
const CartPage = lazy(() => import('./pages/Cart/CartPage'));
const CheckoutPage = lazy(() => import('./pages/Checkout/CheckoutPage'));
const MyPage = lazy(() => import('./pages/MyPage/MyPage'));
const AdminPage = lazy(() => import('./pages/Admin/AdminPage'));
const MailboxPage = lazy(() => import('./pages/Mailbox/MailboxPage'));
const NotificationPage = lazy(() => import('./pages/Notification/NotificationPage'));
const WishlistPage = lazy(() => import('./pages/Wishlist/WishlistPage'));

function App() {
  return (
    <BrowserRouter>
    <AlertProvider>
      <Suspense fallback={<div className="loading"><div className="spinner" />로딩 중...</div>}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<MainPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="products/new" element={<ProductRegisterPage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="mypage" element={<MyPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="mailbox" element={<MailboxPage />} />
            <Route path="notifications" element={<NotificationPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
          </Route>
        </Routes>
      </Suspense>
    </AlertProvider>
    </BrowserRouter>
  );
}

export default App;
