#!/bin/bash
# 클로드가 수정한 서버 파일에서 SQL injection 위험 패턴 감지
# 사용: PostToolUse (Edit, Write) 훅에서 호출
#
# 감지 항목 (차단: exit 2):
#   - 템플릿 리터럴 내 SQL + 변수 삽입: `SELECT ... ${var}`
#   - 문자열 결합 SQL: "SELECT ..." + var

# ─── stdin에서 파일 경로 추출 ───
filepath=$(cat - | jq -r '.tool_input.file_path')

# ─── server/ 내의 .js 파일만 체크 ───
case "$filepath" in
  */server/*.js)
    ;;
  *)
    exit 0
    ;;
esac

# ─── 파일이 존재하는지 확인 ───
if [ ! -f "$filepath" ]; then
  exit 0
fi

block=0

# ─── 템플릿 리터럴 SQL에 변수 삽입 감지 ───
# 예: `SELECT * FROM users WHERE id = ${userId}`
template_matches=$(grep -n -E '(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|SET).*\$\{' "$filepath" 2>/dev/null | head -5)
if [ -n "$template_matches" ]; then
  echo "⚠ [SQL injection 위험] 템플릿 리터럴에 변수를 직접 삽입하지 마세요"
  echo "  → db.execute(sql, [param]) 형태로 ? 파라미터를 사용하세요"
  echo "$template_matches"
  echo ""
  block=1
fi

# ─── 문자열 결합 SQL 감지 ───
# 예: "SELECT * FROM users WHERE id = " + userId
concat_matches=$(grep -n -E "(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE).*[\"']\s*\+" "$filepath" 2>/dev/null | grep -v -E '\.join\(|\.map\(' | head -5)
if [ -n "$concat_matches" ]; then
  echo "⚠ [SQL injection 위험] SQL 문자열 결합을 사용하지 마세요"
  echo "  → db.execute(sql, [param]) 형태로 ? 파라미터를 사용하세요"
  echo "$concat_matches"
  echo ""
  block=1
fi

if [ "$block" -eq 1 ]; then
  echo "SQL injection 위험이 있는 코드를 수정해야 진행할 수 있습니다."
  exit 2
fi

exit 0
