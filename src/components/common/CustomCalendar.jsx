import React, { useState } from 'react';
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
  noWrapper = false // New prop to remove the card wrapper
}) => {
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Convert yyyy-mm-dd to Date object
  const parseDate = (dateStr) => {
    if (!dateStr) return undefined;
    return new Date(dateStr);
  };

  // Convert Date to yyyy-mm-dd
  const formatDate = (date) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  // Convert yyyy-mm-dd to dd/mm/yyyy for display
  const formatToDisplay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
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
      const today = new Date().toISOString().split('T')[0];
      onStartDateChange(today);
      onEndDateChange(today);
    }
  };

  // Content without wrapper
  const content = (
    <>
      {/* Filter Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
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
          className={`relative ${fieldWidth ? 'flex-shrink-0' : 'flex-1'}`}
          style={fieldWidth ? { width: fieldWidth } : {}}
        >
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-1.5">
            <CalendarIcon className="w-3 h-3 text-blue-600" />
            From
          </label>
          <Popover open={showStartPicker} onOpenChange={setShowStartPicker}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  "w-full bg-slate-50 border-2 border-blue-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm text-left flex items-center justify-between",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className={!startDate ? "text-slate-400" : "text-slate-800"}>
                  {formatToDisplay(startDate) || 'DD/MM/YYYY'}
                </span>
                <CalendarIcon className="w-4 h-4 text-blue-600" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-2 border-blue-200 bg-white" align="start">
              <Calendar
                mode="single"
                selected={parseDate(startDate)}
                onSelect={handleStartDateSelect}
                disabled={(date) => date > new Date()}
                initialFocus
                captionLayout="dropdown"
                fromYear={2020}
                toYear={new Date().getFullYear()}
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
          className={`relative ${fieldWidth ? 'flex-shrink-0' : 'flex-1'}`}
          style={fieldWidth ? { width: fieldWidth } : {}}
        >
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-1.5">
            <CalendarIcon className="w-3 h-3 text-blue-600" />
            To
          </label>
          <Popover open={showEndPicker} onOpenChange={setShowEndPicker}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  "w-full bg-slate-50 border-2 border-blue-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm text-left flex items-center justify-between",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className={!endDate ? "text-slate-400" : "text-slate-800"}>
                  {formatToDisplay(endDate) || 'DD/MM/YYYY'}
                </span>
                <CalendarIcon className="w-4 h-4 text-blue-600" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-2 border-blue-200 bg-white" align="start">
              <Calendar
                mode="single"
                selected={parseDate(endDate)}
                onSelect={handleEndDateSelect}
                disabled={(date) => date > new Date()}
                initialFocus
                captionLayout="dropdown"
                fromYear={2020}
                toYear={new Date().getFullYear()}
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
  disabled = false
}) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

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

  return (
    <div className="bg-white rounded-xl shadow-md border-2 border-blue-100 p-6">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Label */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-sm">
            <CalendarIcon className="w-5 h-5 text-white" />
          </div>
          <label className="text-sm font-bold text-slate-700">{label}</label>
        </div>
        
        {/* Calendar Picker Button */}
        <div className="relative">
          <Popover open={showCalendar} onOpenChange={setShowCalendar}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  "bg-slate-50 border-2 border-blue-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:border-blue-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-left flex items-center justify-between w-[180px]",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-blue-600" />
                  {selectedMonthYear === 'all' ? 'All Months' : selectedMonthYear || 'Select Month/Year'}
                </span>
                <ChevronRight className={cn("w-4 h-4 transition-transform", showCalendar && "rotate-90")} />
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
                  {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map((y) => {
                    const currentYear = new Date().getFullYear();
                    const isYearDisabled = y > currentYear;
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
                  disabled={calendarYear >= new Date().getFullYear()}
                  className={cn(
                    "p-2 rounded-lg transition-colors flex-shrink-0",
                    calendarYear >= new Date().getFullYear()
                      ? "opacity-50 cursor-not-allowed bg-slate-100"
                      : "hover:bg-blue-50"
                  )}
                  title={calendarYear >= new Date().getFullYear() ? "Cannot select future dates" : "Next Year"}
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
                  
                  // Check if it's current month
                  const now = new Date();
                  const currentMonthYear = `${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][now.getMonth()]}${now.getFullYear()}`;
                  const isCurrentMonth = monthYear === currentMonthYear;
                  
                  // Check if it's a future month
                  const isFutureMonth = calendarYear > now.getFullYear() || 
                    (calendarYear === now.getFullYear() && index > now.getMonth());
                  
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => !isFutureMonth && isAvailable && handleMonthSelect(index, calendarYear)}
                      disabled={!isAvailable || isFutureMonth}
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

        {/* Reset Filter Button */}
        {selectedMonthYear && selectedMonthYear !== 'all' && (
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
    </div>
  );
};

// Export both components as default for convenience
export default {
  DateRangePicker,
  MonthYearPicker
};
