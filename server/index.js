const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

// DB 초기화
const initializeDatabase = require('./config/initDB');

// 라우트 불러오기
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const couponRoutes = require('./routes/couponRoutes');
const adminRoutes = require('./routes/adminRoutes');
const mailboxRoutes = require('./routes/mailboxRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const giftRoutes = require('./routes/giftRoutes');
const eventRoutes = require('./routes/eventRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const refundRoutes = require('./routes/refundRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어
const allowedOrigins = process.env.CORS_ORIGIN;
app.use(cors({
  origin: allowedOrigins || true,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Rate Limiting
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: '너무 많은 요청입니다. 15분 후 다시 시도해주세요.' } });
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// 라우트
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mailbox', mailboxRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/gifts', giftRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/refunds', refundRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ message: 'Mini Shop API Server' });
});

// DB 초기화 후 서버 시작
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('DB 초기화 실패:', err);
    process.exit(1);
  });