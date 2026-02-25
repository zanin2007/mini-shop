const db = require('../config/db');

// 활성 공지 목록 (유저용)
exports.getAnnouncements = async (req, res) => {
  try {
    const [announcements] = await db.execute(
      'SELECT * FROM announcements WHERE is_active = true ORDER BY is_pinned DESC, created_at DESC'
    );
    res.json(announcements);
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
