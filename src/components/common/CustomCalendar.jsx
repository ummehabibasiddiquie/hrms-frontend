import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * CustomCalendar Component
 * A reusable calendar component with two modes:
 * 1. Date Range Picker - Select start and end dates (using shadcn calendar)
 * 2. Month Year Picker - Select month and year
 * 
 * Theme: Blue and White
 */

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Convert YYYY-MM → JAN2026 (MonthYearPicker value). */
export function yyyyMmToMonthYear(yyyyMm) {
  if (!yyyyMm || yyyyMm === 'all') return yyyyMm || 'all';
  const [year, month] = String(yyyyMm).split('-');
  const idx = Number(month) - 1;
  if (!year || Number.isNaN(idx) || idx < 0 || idx > 11) return 'all';
  return `${MONTH_ABBR[idx]}${year}`;
}

/** Convert JAN2026 → YYYY-MM. */
export function monthYearToYyyyMm(monthYear) {
  if (!monthYear || monthYear === 'all') return '';
  const match = String(monthYear).trim().match(/^([A-Za-z]{3})(\d{4})$/);
  if (!match) return '';
  const idx = MONTH_ABBR.indexOf(match[1].toUpperCase());
  if (idx < 0) return '';
  return `${match[2]}-${String(idx + 1).padStart(2, '0')}`;
}

/** Current month as YYYY-MM. */
export function getCurrentYyyyMm() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Date Range Picker Component with shadcn Calendar
export const DateRangePicker = ({ 
  startDate, 
  endDate, 
  onStartDateChange, 
  onEndDateChange,
  onClear,
  label = 'Date Range Filter',
  description = 'Select your preferred date range',
  showClearButton = true,
  disabled = false,
  compact = false,
  fieldWidth = null,
  noWrapper = false, // New prop to remove the card wrapper
  disabledMonths = null, // New prop to restrict calendar to specific months
  showOnlySelectedMonth = false // New prop to show only the selected month without dropdown
}) => {
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Convert yyyy-mm-dd to Date object (local midnight — avoid UTC shift)
  const parseDate = (dateStr) => {
    if (!dateStr) return undefined;
    const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    return new Date(dateStr);
  };

  // Convert Date to yyyy-mm-dd (local calendar day)
  const formatDate = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Convert yyyy-mm-dd to dd/mm/yyyy for display
  const formatToDisplay = (dateStr) => {
    if (!dateStr) return '';
    const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    const date = parseDate(dateStr);
    if (!date || Number.isNaN(date.getTime())) return '';
    return format(date, 'dd/MM/yyyy');
  };

  // Handle date selection
  const handleStartDateSelect = (date) => {
    if (date) {
      onStartDateChange(formatDate(date));
      setShowStartPicker(false);
    }
  };

  const handleEndDateSelect = (date) => {
    if (date) {
      onEndDateChange(formatDate(date));
      setShowEndPicker(false);
    }
  };

  // Handle clear - reset to today's date or empty
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      const today = formatDate(new Date());
      onStartDateChange(today);
      onEndDateChange(today);
    }
  };

  // Function to check if a date is in the allowed month(s)
  const isDateInAllowedMonth = (date) => {
    if (!disabledMonths || !Array.isArray(disabledMonths) || disabledMonths.length === 0) {
      return true;
    }
    const dateMonth = date.getMonth();
    const dateYear = date.getFullYear();
    
    // Check if the date's month/year is in the allowed list
    return disabledMonths.some(allowed => {
      if (typeof allowed === 'string' && allowed.includes('-')) {
        const [year, month] = allowed.split('-');
        return dateYear === parseInt(year) && dateMonth === parseInt(month) - 1;
      }
      return false;
    });
  };

  // Disable dates that are not in the allowed month(s)
  const isDateDisabled = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (day > today) {
      return true;
    }
    return !isDateInAllowedMonth(date);
  };

  // Content without wrapper
  const content = (
    <>
      {/* Filter Controls */}
      <div className={cn(
        "flex items-end gap-3",
        !noWrapper && "flex-col lg:flex-row items-stretch lg:items-center gap-4"
      )}>
        {/* Header with Calendar Icon - Left side (only show if not noWrapper) */}
        {!noWrapper && (
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-sm">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">{label}</h3>
              {description && <p className="text-xs text-slate-500 font-medium">{description}</p>}
            </div>
          </div>
        )}

        {/* Start Date Picker */}
        <div 
          className={`relative shrink-0 ${fieldWidth ? '' : 'flex-1'}`}
          style={fieldWidth ? { width: fieldWidth } : {}}
        >
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            From
          </label>
          <Popover open={showStartPicker} onOpenChange={(open) => {
            setShowStartPicker(open);
            if (open) setShowEndPicker(false);
          }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  "w-full h-11 bg-slate-50 border border-slate-300 rounded-lg px-3 text-sm font-medium text-slate-800 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-left flex items-center justify-between",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className={!startDate ? "text-slate-400" : "text-slate-800"}>
                  {formatToDisplay(startDate) || 'DD/MM/YYYY'}
                </span>
                <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-2 border-blue-200 bg-white" align="start">
              <Calendar
                mode="single"
                selected={parseDate(startDate)}
                onSelect={handleStartDateSelect}
                disabled={isDateDisabled}
                initialFocus
                captionLayout={showOnlySelectedMonth ? "label" : "dropdown"}
                fromYear={showOnlySelectedMonth ? undefined : 2020}
                toYear={showOnlySelectedMonth ? undefined : new Date().getFullYear()}
                month={showOnlySelectedMonth && disabledMonths && disabledMonths[0] ? 
                  (() => {
                    const [year, month] = disabledMonths[0].split('-');
                    return new Date(parseInt(year), parseInt(month) - 1);
                  })() : undefined
                }
                className="rounded-md bg-white"
              />
              <div className="p-3 border-t-2 border-blue-100 bg-blue-50">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    onStartDateChange(formatDate(today));
                    setShowStartPicker(false);
                  }}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-xs transition-colors shadow-sm"
                >
                  Select Today
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date Picker */}
        <div 
          className={`relative shrink-0 ${fieldWidth ? '' : 'flex-1'}`}
          style={fieldWidth ? { width: fieldWidth } : {}}
        >
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            To
          </label>
          <Popover open={showEndPicker} onOpenChange={(open) => {
            setShowEndPicker(open);
            if (open) setShowStartPicker(false);
          }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  "w-full h-11 bg-slate-50 border border-slate-300 rounded-lg px-3 text-sm font-medium text-slate-800 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-left flex items-center justify-between",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className={!endDate ? "text-slate-400" : "text-slate-800"}>
                  {formatToDisplay(endDate) || 'DD/MM/YYYY'}
                </span>
                <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-2 border-blue-200 bg-white" align="start">
              <Calendar
                mode="single"
                selected={parseDate(endDate)}
                onSelect={handleEndDateSelect}
                disabled={isDateDisabled}
                initialFocus
                captionLayout={showOnlySelectedMonth ? "label" : "dropdown"}
                fromYear={showOnlySelectedMonth ? undefined : 2020}
                toYear={showOnlySelectedMonth ? undefined : new Date().getFullYear()}
                month={showOnlySelectedMonth && disabledMonths && disabledMonths[0] ? 
                  (() => {
                    const [year, month] = disabledMonths[0].split('-');
                    return new Date(parseInt(year), parseInt(month) - 1);
                  })() : undefined
                }
                className="rounded-md bg-white"
              />
              <div className="p-3 border-t-2 border-blue-100 bg-blue-50">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    onEndDateChange(formatDate(today));
                    setShowEndPicker(false);
                  }}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-xs transition-colors shadow-sm"
                >
                  Select Today
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Clear/Reset Button */}
        {showClearButton && (
          <div className="flex-shrink-0 self-end">
            <button
              type="button"
              disabled={disabled}
              onClick={handleClear}
              className={cn(
                "w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-sm rounded-lg px-6 py-2.5 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
              Reset to Today
            </button>
          </div>
        )}
      </div>
    </>
  );

  // Conditionally wrap with card styling
  if (noWrapper) {
    return content;
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-md border-2 border-blue-100">
      {content}
    </div>
  );
};

// Month Year Picker Component (Custom Implementation with Blue/White Theme)
export const MonthYearPicker = ({
  selectedMonthYear,
  onMonthYearChange,
  onClear,
  label = 'Filter by Month/Year',
  availableMonthYears = [],
  showAllOption = true,
  disabled = false,
  compact = false,
  /** When true, months/years after the current calendar month can be selected (needed for roster planning). */
  allowFutureMonths = false,
}) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const now = new Date();
  const currentYear = now.getFullYear();
  const maxYear = allowFutureMonths ? currentYear + 2 : currentYear;

  useEffect(() => {
    if (!selectedMonthYear || selectedMonthYear === 'all') return;
    const match = String(selectedMonthYear).match(/^([A-Z]{3})(\d{4})$/);
    if (match) setCalendarYear(parseInt(match[2], 10));
  }, [selectedMonthYear]);

  // Handle month selection
  const handleMonthSelect = (month, year) => {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthYear = `${monthNames[month]}${year}`;
    onMonthYearChange(monthYear);
    setShowCalendar(false);
  };

  // Handle clear
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onMonthYearChange('all');
    }
    setShowCalendar(false);
  };

  const pickerContent = (
    <div className={cn(compact ? "flex flex-col" : "flex items-center gap-4 flex-wrap")}>
      {!compact && (
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-sm">
            <CalendarIcon className="w-5 h-5 text-white" />
          </div>
          <label className="text-sm font-bold text-slate-700">{label}</label>
        </div>
      )}

      {compact && label && (
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <CalendarIcon className="w-4 h-4 text-blue-600" />
          {label}
        </label>
      )}

      <div className="relative">
          <Popover open={showCalendar} onOpenChange={setShowCalendar}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  "text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all text-left flex items-center justify-between",
                  compact
                    ? "bg-slate-50 border border-slate-300 rounded-lg px-4 h-11 w-[190px]"
                    : "bg-slate-50 border-2 border-blue-200 rounded-lg px-4 py-2.5 hover:bg-blue-50 hover:border-blue-500 focus:border-blue-500 w-[180px]",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  {!compact && <CalendarIcon className="w-4 h-4 text-blue-600" />}
                  {selectedMonthYear === 'all'
                    ? 'All Months'
                    : selectedMonthYear
                      ? (() => {
                          const match = selectedMonthYear.match(/^([A-Z]{3})(\d{4})$/);
                          if (!match) return selectedMonthYear;
                          const monthMap = { JAN: 'January', FEB: 'February', MAR: 'March', APR: 'April', MAY: 'May', JUN: 'June', JUL: 'July', AUG: 'August', SEP: 'September', OCT: 'October', NOV: 'November', DEC: 'December' };
                          return `${monthMap[match[1]] || match[1]} ${match[2]}`;
                        })()
                      : 'Select Month'}
                </span>
                {compact
                  ? <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
                  : <ChevronRight className={cn("w-4 h-4 transition-transform", showCalendar && "rotate-90")} />
                }
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] border-2 border-blue-200 bg-white" align="start">
              {/* Year Navigation with Dropdown */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-blue-100 gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarYear(calendarYear - 1)}
                  className="p-2 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                  title="Previous Year"
                >
                  <ChevronLeft className="w-5 h-5 text-blue-600" />
                </button>
                
                {/* Year Dropdown */}
                <select
                  value={calendarYear}
                  onChange={(e) => setCalendarYear(parseInt(e.target.value))}
                  className="flex-1 px-3 py-1.5 text-base font-bold text-slate-800 bg-slate-50 border-2 border-blue-200 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer text-center"
                >
                  {Array.from({ length: maxYear - (currentYear - 10) + 1 }, (_, i) => currentYear - 10 + i).map((y) => {
                    const isYearDisabled = !allowFutureMonths && y > currentYear;
                    return (
                      <option key={y} value={y} disabled={isYearDisabled}>
                        {y}
                      </option>
                    );
                  })}
                </select>
                
                <button
                  type="button"
                  onClick={() => setCalendarYear(calendarYear + 1)}
                  disabled={calendarYear >= maxYear}
                  className={cn(
                    "p-2 rounded-lg transition-colors flex-shrink-0",
                    calendarYear >= maxYear
                      ? "opacity-50 cursor-not-allowed bg-slate-100"
                      : "hover:bg-blue-50"
                  )}
                  title={calendarYear >= maxYear ? "Cannot select further years" : "Next Year"}
                >
                  <ChevronRight className="w-5 h-5 text-blue-600" />
                </button>
              </div>

              {/* Months Grid */}
              <div className="grid grid-cols-3 gap-2 ">
                {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map((month, index) => {
                  const monthYear = `${month}${calendarYear}`;
                  const isSelected = selectedMonthYear === monthYear;
                  const isAvailable = availableMonthYears.length === 0 || availableMonthYears.includes(monthYear);
                  
                  const currentMonthYear = `${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][now.getMonth()]}${now.getFullYear()}`;
                  const isCurrentMonth = monthYear === currentMonthYear;
                  
                  const isFutureMonth = !allowFutureMonths && (
                    calendarYear > now.getFullYear() ||
                    (calendarYear === now.getFullYear() && index > now.getMonth())
                  );
                  const canSelect = isAvailable && !isFutureMonth;
                  
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => canSelect && handleMonthSelect(index, calendarYear)}
                      disabled={!canSelect}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        isFutureMonth
                          ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                          : isSelected 
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md' 
                            : isAvailable
                              ? isCurrentMonth
                                ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 hover:bg-blue-200'
                                : 'bg-blue-50 text-slate-700 hover:bg-blue-100 border-2 border-blue-200'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      )}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>

              {/* All Months Option */}
              {showAllOption && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 text-sm font-medium rounded-lg transition-all border-2 border-slate-300"
                >
                  Show All Months
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {!compact && selectedMonthYear && selectedMonthYear !== 'all' && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleClear}
            className={cn(
              "w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-sm rounded-lg px-6 py-2.5 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
            Reset Filter
          </button>
        )}
    </div>
  );

  if (compact) {
    return pickerContent;
  }

  return (
    <div className="bg-white rounded-xl shadow-md border-2 border-blue-100 p-6">
      {pickerContent}
    </div>
  );
};

// Export both components as default for convenience
export default {
  DateRangePicker,
  MonthYearPicker,
  yyyyMmToMonthYear,
  monthYearToYyyyMm,
  getCurrentYyyyMm,
};
