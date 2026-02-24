import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AlertProvider } from './components/AlertContext';
import Layout from './components/Layout';
import MainPage from './pages/Main/MainPage';
import LoginPage from './pages/Auth/LoginPage';
import SignupPage from './pages/Auth/SignupPage';
import ProductDetailPage from './pages/Product/ProductDetailPage';
import ProductRegisterPage from './pages/Product/ProductRegisterPage';
import CartPage from './pages/Cart/CartPage';
import CheckoutPage from './pages/Checkout/CheckoutPage';
import MyPage from './pages/MyPage/MyPage';
import AdminPage from './pages/Admin/AdminPage';
import MailboxPage from './pages/Mailbox/MailboxPage';
import NotificationPage from './pages/Notification/NotificationPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
    <AlertProvider>
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
        </Route>
      </Routes>
    </AlertProvider>
    </BrowserRouter>
  );
}

export default App;
