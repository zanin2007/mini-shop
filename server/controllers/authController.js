const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// 회원가입
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

// 로그인
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
        role: user.role
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

// 유저 검색 (선물하기용)
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

// 닉네임 변경
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

// 비밀번호 변경
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

// 인증 확인
exports.checkAuth = async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, email, nickname FROM users WHERE id = ?',
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
