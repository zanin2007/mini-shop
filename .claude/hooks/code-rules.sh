#!/bin/bash
# 클로드가 수정한 파일에서 코딩 규칙 위반 감지
# 사용: PostToolUse (Edit, Write) 훅에서 호출
#
# 감지 항목:
#   - any 타입 사용 (: any, as any, <any>)
#   - console.log 잔류
#   - alert() 사용 (showAlert 사용해야 함)
#   - eslint-disable 사용

# ─── stdin에서 파일 경로 추출 ───
filepath=$(cat - | jq -r '.tool_input.file_path')

# ─── client/src 내의 .ts/.tsx 파일만 체크 ───
case "$filepath" in
  */client/src/*.ts|*/client/src/*.tsx)
    ;;
  *)
    exit 0
    ;;
esac

# ─── 파일이 존재하는지 확인 ───
if [ ! -f "$filepath" ]; then
  exit 0
fi

found=0

# ─── any 타입 감지 ───
any_matches=$(grep -n -E ':\s*any\b|as\s+any\b|<any>' "$filepath" 2>/dev/null | grep -v '// ok' | head -5)
if [ -n "$any_matches" ]; then
  echo "⚠ [any 타입 감지] CLAUDE.md 규칙: any 타입 사용 금지"
  echo "$any_matches"
  echo ""
  found=1
fi

# ─── console.log 감지 ───
log_matches=$(grep -n 'console\.log' "$filepath" 2>/dev/null | head -5)
if [ -n "$log_matches" ]; then
  echo "⚠ [console.log 감지] 배포 전 제거 필요"
  echo "$log_matches"
  echo ""
  found=1
fi

# ─── alert() 감지 (import 문 제외, showAlert 제외) ───
alert_matches=$(grep -n '\balert(' "$filepath" 2>/dev/null | grep -v 'showAlert' | grep -v 'import' | head -5)
if [ -n "$alert_matches" ]; then
  echo "⚠ [alert() 감지] CLAUDE.md 규칙: showAlert() 사용 필요"
  echo "$alert_matches"
  echo ""
  found=1
fi

# ─── eslint-disable 감지 ───
disable_matches=$(grep -n 'eslint-disable' "$filepath" 2>/dev/null | head -5)
if [ -n "$disable_matches" ]; then
  echo "⚠ [eslint-disable 감지] CLAUDE.md 규칙: eslint-disable 사용 금지"
  echo "$disable_matches"
  echo ""
  found=1
fi

if [ "$found" -eq 0 ]; then
  exit 0
fi
