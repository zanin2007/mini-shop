/**
 * 라우트 파라미터 ID 숫자 검증 미들웨어
 * - 지정된 파라미터가 양의 정수인지 확인
 * - 유효하지 않으면 400 응답
 */
const validateId = (paramName = 'id') => (req, res, next) => {
  const id = Number(req.params[paramName]);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: '유효하지 않은 ID입니다.' });
  }
  req.params[paramName] = String(id);
  next();
};

module.exports = { validateId };
