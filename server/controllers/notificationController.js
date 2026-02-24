const db = require('../config/db');

// 알림 목록 조회
exports.getNotifications = async (req, res) => {
  try {
    const [notifications] = await db.execute(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user.userId]
    );
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 안읽은 알림 수
exports.getUnreadCount = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false`,
      [req.user.userId]
    );
    res.json({ count: rows[0].count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 알림 읽음 처리
exports.markAsRead = async (req, res) => {
  try {
    await db.execute(
      `UPDATE notifications SET is_read = true WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.userId]
    );
    res.json({ message: '읽음 처리되었습니다.' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 전체 읽음 처리
exports.markAllAsRead = async (req, res) => {
  try {
    await db.execute(
      `UPDATE notifications SET is_read = true WHERE user_id = ? AND is_read = false`,
      [req.user.userId]
    );
    res.json({ message: '전체 읽음 처리되었습니다.' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
