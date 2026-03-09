#!/bin/bash
# 클로드가 client/src 파일을 수정했을 때 ESLint 체크 실행
# 사용: PostToolUse (Edit, Write) 훅에서 호출

# ─── 설정 ───
CLIENT_DIR="client"
MAX_ERROR_LINES=20

# ─── stdin에서 파일 경로 추출 ───
filepath=$(cat - | jq -r '.tool_input.file_path')

# ─── client/src 내의 .ts/.tsx 파일인지 확인 ───
case "$filepath" in
  */client/src/*.ts|*/client/src/*.tsx)
    cd "$CLIENT_DIR" && npx eslint "$filepath" --format stylish 2>&1 | head -"$MAX_ERROR_LINES"
    ;;
esac
