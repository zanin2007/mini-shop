const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ message: '유효하지 않은 토큰입니다.' });
    }

    // 정지 유저 실시간 체크 (관리자 제외)
    if (user.role !== 'admin') {
      try {
        const [penalties] = await db.execute(
          `SELECT type, reason, suspended_until FROM user_penalties
           WHERE user_id = ? AND is_active = true AND type != 'warning'
           AND (suspended_until IS NULL OR suspended_until > NOW())
           LIMIT 1`,
          [user.userId]
        );
        if (penalties.length > 0) {
          const penalty = penalties[0];
          if (penalty.type === 'permanent') {
            return res.status(403).json({ message: '영구 정지된 계정입니다. 사유: ' + penalty.reason });
          }
          const until = new Date(penalty.suspended_until).toLocaleDateString('ko-KR');
          return res.status(403).json({ message: `${until}까지 이용 정지된 계정입니다. 사유: ${penalty.reason}` });
        }
      } catch (penaltyError) {
        // DB 오류 시 인증은 통과 (가용성 우선) — 에러 로깅은 유지
        console.error('제재 확인 DB 오류:', penaltyError);
      }
    }

    req.user = user;
    next();
  });
};

exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
  }
  next();
};
