import { useState, useCallback } from 'react';

/**
 * 비동기 작업의 처리 중 상태를 ID별로 추적하는 훅
 * - 버튼 연타 방지, "처리 중..." 표시에 활용
 */
export function useProcessing() {
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  const startProcessing = useCallback((id: number) => {
    setProcessingIds(prev => new Set(prev).add(id));
  }, []);

  const stopProcessing = useCallback((id: number) => {
    setProcessingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isProcessing = useCallback((id: number) => processingIds.has(id), [processingIds]);

  return { isProcessing, startProcessing, stopProcessing };
}
