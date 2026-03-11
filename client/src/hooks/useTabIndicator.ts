import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 탭 슬라이딩 인디케이터 + 키보드 네비게이션 공통 hook
 * - 인디케이터 위치/크기 자동 계산 (리사이즈 대응)
 * - ArrowLeft/Right, Home/End 키보드 탐색
 */
export function useTabIndicator<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  onTabClick: (tab: T) => void,
) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback((tab: T) => {
    const el = tabRefs.current.get(tab);
    const container = tabsRef.current;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = el.getBoundingClientRect();
      setIndicator({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      });
    }
  }, []);

  useEffect(() => {
    updateIndicator(activeTab);
  }, [activeTab, updateIndicator]);

  useEffect(() => {
    const handleResize = () => updateIndicator(activeTab);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab, updateIndicator]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIdx = tabs.indexOf(activeTab);
    let nextIdx = -1;

    if (e.key === 'ArrowRight') {
      nextIdx = (currentIdx + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = tabs.length - 1;
    }

    if (nextIdx >= 0) {
      e.preventDefault();
      const nextTab = tabs[nextIdx];
      onTabClick(nextTab);
      tabRefs.current.get(nextTab)?.focus();
    }
  }, [tabs, activeTab, onTabClick]);

  const setTabRef = useCallback((tab: T) => (el: HTMLButtonElement | null) => {
    if (el) tabRefs.current.set(tab, el);
  }, []);

  return { tabsRef, setTabRef, indicator, handleKeyDown };
}
