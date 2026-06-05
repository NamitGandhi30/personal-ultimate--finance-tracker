"use client";

import { useEffect, useRef, useState } from "react";

type CustomDatePickerProps = {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
};

export function CustomDatePicker({ value, onChange }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current date value
  const selectedDate = value ? new Date(value) : new Date();
  const [activeMonth, setActiveMonth] = useState(() => selectedDate);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const year = activeMonth.getFullYear();
  const month = activeMonth.getMonth();

  // Days in month calculation
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (() => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Mon = 0, Tue = 1, ..., Sun = 6
  })();

  const calendarDays: (string | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
  }

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const formattedValue = () => {
    if (!value) return "Select date";
    const d = new Date(value);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return "Today";
    }
    return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMonth(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (dayStr: string) => {
    onChange(dayStr);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const todayStr = new Date().toISOString().split("T")[0];
    onChange(todayStr);
    setActiveMonth(new Date());
    setIsOpen(false);
  };

  return (
    <div className="custom-datepicker-container" ref={containerRef}>
      <button
        type="button"
        className="quick-entry-date-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select transaction date"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: "8px", color: "var(--green)" }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{formattedValue()}</span>
      </button>

      {isOpen && (
        <div className="custom-datepicker-dropdown">
          <div className="datepicker-header">
            <button type="button" className="datepicker-nav-btn" onClick={handlePrevMonth}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="datepicker-selects">
              <select
                className="datepicker-select month-select"
                value={month}
                onChange={(e) => {
                  const newMonth = parseInt(e.target.value, 10);
                  setActiveMonth(new Date(year, newMonth, 1));
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {monthNames.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                className="datepicker-select year-select"
                value={year}
                onChange={(e) => {
                  const newYear = parseInt(e.target.value, 10);
                  setActiveMonth(new Date(newYear, month, 1));
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {Array.from({ length: 36 }, (_, i) => 2000 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="datepicker-nav-btn" onClick={handleNextMonth}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className="datepicker-weekdays">
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
            <span>S</span>
            <span>S</span>
          </div>

          <div className="datepicker-grid">
            {calendarDays.map((dayStr, idx) => {
              if (!dayStr) {
                return <div key={`empty-${idx}`} className="datepicker-cell empty" />;
              }
              const dayNum = parseInt(dayStr.split("-")[2], 10);
              const isSelected = value === dayStr;
              const isToday = new Date().toISOString().split("T")[0] === dayStr;

              return (
                <button
                  type="button"
                  key={dayStr}
                  className={`datepicker-cell day${isSelected ? " selected" : ""}${isToday ? " today" : ""}`}
                  onClick={() => handleSelectDay(dayStr)}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <div className="datepicker-footer">
            <button type="button" className="datepicker-today-btn" onClick={handleSelectToday}>
              Select Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
