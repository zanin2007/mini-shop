const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * 인증 컨트롤러
 * - 회원가입/로그인/로그아웃: JWT 기반 인증
 * - 유저 검색: 선물하기용 닉네임/이메일 검색
 * - 계정 관리: 닉네임 변경, 비밀번호 변경, 회원탈퇴
 * - 인증 확인: 토큰 유효성 검증 및 최신 유저 정보 반환 (role, points 포함)
 */

// 회원가입 — 이메일 중복 확인 후 bcrypt 해싱하여 저장
exports.signup = async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    const password = (req.body.password || '').trim();
    const nickname = (req.body.nickname || '').trim();

    // 유효성 검사
    if (!email || !password || !nickname) {
      return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
    }

    // 이메일 중복 확인
    const [existingUser] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ message: '이미 존재하는 이메일입니다.' });
    }

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    await db.execute(
      'INSERT INTO users (email, password, nickname) VALUES (?, ?, ?)',
      [email, hashedPassword, nickname]
    );

    res.status(201).json({ message: '회원가입이 완료되었습니다.' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 로그인 — 비밀번호 검증 → 정지 상태 확인 → JWT 토큰 발급 (7일 유효)
exports.login = async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    const password = (req.body.password || '').trim();

    // 사용자 조회
    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
    }

    const user = users[0];

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
    }

    // 정지 상태 확인
    const [penalties] = await db.execute(
      `SELECT * FROM user_penalties
       WHERE user_id = ? AND is_active = true AND type != 'warning'
       AND (suspended_until IS NULL OR suspended_until > NOW())
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (penalties.length > 0) {
      const penalty = penalties[0];
      if (penalty.type === 'permanent') {
        return res.status(403).json({ message: '영구 정지된 계정입니다. 사유: ' + penalty.reason });
      }
      const until = new Date(penalty.suspended_until).toLocaleDateString('ko-KR');
      return res.status(403).json({ message: `${until}까지 이용 정지된 계정입니다. 사유: ${penalty.reason}` });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: '로그인 성공',
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        points: user.points || 0
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 로그아웃
exports.logout = (req, res) => {
  res.json({ message: '로그아웃 되었습니다.' });
};

// 유저 검색 — 선물하기용, 닉네임/이메일로 본인 제외 최대 10명 검색
exports.searchUser = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }
    const [users] = await db.execute(
      `SELECT id, nickname, email FROM users WHERE id != ? AND (nickname LIKE ? OR email LIKE ?) LIMIT 10`,
      [req.user.userId, `%${q}%`, `%${q}%`]
    );
    res.json(users);
  } catch (error) {
    console.error('Search user error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 닉네임 변경 — 로그인된 유저의 닉네임 업데이트
exports.changeNickname = async (req, res) => {
  try {
    const nickname = (req.body.nickname || '').trim();
    if (!nickname) {
      return res.status(400).json({ message: '닉네임을 입력해주세요.' });
    }
    await db.execute('UPDATE users SET nickname = ? WHERE id = ?', [nickname, req.user.userId]);
    res.json({ message: '닉네임이 변경되었습니다.', nickname });
  } catch (error) {
    console.error('Change nickname error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 비밀번호 변경 — 현재 비밀번호 확인 후 새 비밀번호로 변경 (최소 4자)
exports.changePassword = async (req, res) => {
  try {
    const currentPassword = (req.body.currentPassword || '').trim();
    const newPassword = (req.body.newPassword || '').trim();

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ message: '새 비밀번호는 4자 이상이어야 합니다.' });
    }

    const [users] = await db.execute('SELECT password FROM users WHERE id = ?', [req.user.userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, users[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.userId]);

    res.json({ message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 회원탈퇴 — 비밀번호 재확인 후 계정 삭제 (CASCADE로 연관 데이터 삭제)
exports.deleteAccount = async (req, res) => {
  try {
    const password = (req.body.password || '').trim();
    if (!password) {
      return res.status(400).json({ message: '비밀번호를 입력해주세요.' });
    }

    const [users] = await db.execute('SELECT password FROM users WHERE id = ?', [req.user.userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const isMatch = await bcrypt.compare(password, users[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: '비밀번호가 일치하지 않습니다.' });
    }

    await db.execute('DELETE FROM users WHERE id = ?', [req.user.userId]);
    res.json({ message: '회원탈퇴가 완료되었습니다.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 인증 확인 — JWT 토큰 유효성 검증 후 최신 유저 정보 반환 (role, points 포함)
exports.checkAuth = async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, email, nickname, role, points FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Check auth error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
