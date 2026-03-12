/**
 * DateTimePicker — 커스텀 날짜+시간 선택 컴포넌트
 * - 달력 UI로 날짜 선택, 스크롤 리스트로 시/분 선택
 * - value/onChange 인터페이스 (datetime-local과 동일한 "YYYY-MM-DDTHH:mm" 포맷)
 * - ESC로 닫기, 외부 클릭으로 닫기
 * - 프로젝트 디자인 시스템(CSS 변수) 사용
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import './date-time-picker.css';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const pad = (n: number) => String(n).padStart(2, '0');

const formatDisplay = (value: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}. ${mm}. ${dd}.  ${hh}:${mi}`;
};

const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

const getFirstDayOfWeek = (year: number, month: number) =>
  new Date(year, month, 1).getDay();

function DateTimePicker({ value, onChange, className, placeholder = '날짜와 시간을 선택하세요' }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minuteScrollRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);

  // 현재 보고 있는 월 (달력 네비게이션용)
  const now = new Date();
  const parsed = value ? new Date(value) : null;
  const isValidParsed = parsed && !isNaN(parsed.getTime());

  const [viewYear, setViewYear] = useState(isValidParsed ? parsed.getFullYear() : now.getFullYear());
  const [viewMonth, setViewMonth] = useState(isValidParsed ? parsed.getMonth() : now.getMonth());

  // 선택된 날짜/시간 (임시 상태 — 확인 눌러야 반영)
  const [selectedDay, setSelectedDay] = useState(isValidParsed ? parsed.getDate() : now.getDate());
  const [selectedHour, setSelectedHour] = useState(isValidParsed ? parsed.getHours() : now.getHours());
  const [selectedMinute, setSelectedMinute] = useState(isValidParsed ? parsed.getMinutes() : 0);

  // value가 외부에서 바뀌면 내부 상태 동기화
  useEffect(() => {
    if (!value) return;
    const d = new Date(value);
    if (isNaN(d.getTime())) return;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(d.getDate());
    setSelectedHour(d.getHours());
    setSelectedMinute(d.getMinutes());
  }, [value]);

  // 팝오버 열릴 때 선택된 시간으로 스크롤
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!justOpened) return;
    const scrollToSelected = (ref: HTMLDivElement | null, index: number) => {
      if (!ref) return;
      const optionHeight = 28;
      ref.scrollTop = index * optionHeight - ref.clientHeight / 2 + optionHeight / 2;
    };
    requestAnimationFrame(() => {
      scrollToSelected(hourScrollRef.current, selectedHour);
      scrollToSelected(minuteScrollRef.current, selectedMinute);
    });
  }, [open, selectedHour, selectedMinute]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (day: number, isOtherMonth: boolean) => {
    if (isOtherMonth) return;
    setSelectedDay(day);
  };

  const handleConfirm = useCallback(() => {
    const maxDay = getDaysInMonth(viewYear, viewMonth);
    const safeDay = Math.min(selectedDay, maxDay);
    const result = `${viewYear}-${pad(viewMonth + 1)}-${pad(safeDay)}T${pad(selectedHour)}:${pad(selectedMinute)}`;
    onChange(result);
    setOpen(false);
  }, [viewYear, viewMonth, selectedDay, selectedHour, selectedMinute, onChange]);

  const handleToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    setSelectedDay(t.getDate());
    setSelectedHour(t.getHours());
    setSelectedMinute(t.getMinutes());
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // 달력 데이터 생성
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  // viewMonth=0(1월)이면 month=-1 → new Date(year, 0, 0)으로 이전 해 12월 일수 반환
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1);

  const calendarDays: Array<{ day: number; isOtherMonth: boolean }> = [];

  // 이전 달 날짜
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthDays - i, isOtherMonth: true });
  }
  // 이번 달 날짜
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, isOtherMonth: false });
  }
  // 다음 달 날짜 (6주 채우기)
  const remaining = 42 - calendarDays.length;
  for (let d = 1; d <= remaining; d++) {
    calendarDays.push({ day: d, isOtherMonth: true });
  }

  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  return (
    <div className="dtp-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className={`dtp-trigger ${value ? 'has-value' : 'placeholder'} ${className || ''}`}
        onClick={() => setOpen(!open)}
      >
        <svg className="dtp-trigger-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <circle cx="16" cy="16" r="2" />
          <path d="M16 14v1" />
        </svg>
        <span>{value ? formatDisplay(value) : placeholder}</span>
        {value && (
          <button type="button" className="dtp-clear" onClick={handleClear} aria-label="초기화">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </button>

      {open && (
        <div className="dtp-popover">
          <div className="dtp-calendar">
            {/* 달력 헤더 */}
            <div className="dtp-cal-header">
              <span className="dtp-cal-title">{viewYear}년 {viewMonth + 1}월</span>
              <div className="dtp-cal-nav">
                <button type="button" onClick={handlePrevMonth} aria-label="이전 달">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button type="button" onClick={handleNextMonth} aria-label="다음 달">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 요일 헤더 */}
            <div className="dtp-weekdays">
              {WEEKDAYS.map(w => (
                <span key={w} className="dtp-weekday">{w}</span>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="dtp-days">
              {calendarDays.map((item, idx) => {
                const dayOfWeek = idx % 7;
                const isToday = !item.isOtherMonth && viewYear === todayYear && viewMonth === todayMonth && item.day === todayDate;
                const isSelected = !item.isOtherMonth && item.day === selectedDay;

                const classes = [
                  'dtp-day',
                  item.isOtherMonth ? 'other-month' : '',
                  isToday ? 'today' : '',
                  isSelected ? 'selected' : '',
                  dayOfWeek === 0 ? 'sunday' : '',
                  dayOfWeek === 6 ? 'saturday' : '',
                ].filter(Boolean).join(' ');

                return (
                  <button
                    key={`${item.isOtherMonth ? 'o' : 'c'}-${item.day}`}
                    type="button"
                    className={classes}
                    onClick={() => handleDayClick(item.day, item.isOtherMonth)}
                    tabIndex={item.isOtherMonth ? -1 : 0}
                  >
                    {item.day}
                  </button>
                );
              })}
            </div>

            {/* 하단 버튼 */}
            <div className="dtp-footer">
              <button type="button" className="dtp-footer-btn dtp-today-btn" onClick={handleToday}>
                오늘
              </button>
              <button type="button" className="dtp-footer-btn dtp-confirm-btn" onClick={handleConfirm}>
                확인
              </button>
            </div>
          </div>

          {/* 시간 선택 */}
          <div className="dtp-time">
            <span className="dtp-time-label">시간 선택</span>
            <div className="dtp-time-selectors">
              <div className="dtp-time-col">
                <div className="dtp-time-scroll" ref={hourScrollRef}>
                  {HOURS.map(h => (
                    <button
                      key={h}
                      type="button"
                      className={`dtp-time-option ${h === selectedHour ? 'selected' : ''}`}
                      onClick={() => setSelectedHour(h)}
                    >
                      {pad(h)}
                    </button>
                  ))}
                </div>
              </div>
              <span className="dtp-time-separator">:</span>
              <div className="dtp-time-col">
                <div className="dtp-time-scroll" ref={minuteScrollRef}>
                  {MINUTES.map(m => (
                    <button
                      key={m}
                      type="button"
                      className={`dtp-time-option ${m === selectedMinute ? 'selected' : ''}`}
                      onClick={() => setSelectedMinute(m)}
                    >
                      {pad(m)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DateTimePicker;
