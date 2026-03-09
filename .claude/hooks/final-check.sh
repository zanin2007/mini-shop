#!/bin/bash
# 클로드 응답 완료 시 최종 TypeScript 타입 체크
# 사용: Stop 훅에서 호출

# ─── 설정 ───
CLIENT_DIR="client"
SUMMARY_LINES=5

# ─── 최종 타입 체크 ───
cd "$CLIENT_DIR" && npx tsc --noEmit --pretty 2>&1 | tail -"$SUMMARY_LINES"
