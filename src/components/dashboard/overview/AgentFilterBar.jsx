import React from 'react';
import { RotateCcw, Filter } from 'lucide-react';
import { DateRangePicker } from '../../common/CustomCalendar';

const AgentFilterBar = ({ dateRange, setDateRange }) => {
  // Clear filters - reset to today's date
  const handleClear = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateRange({ start: today, end: today });
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-md border border-slate-200 mb-4">
      {/* Filter Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
        {/* Header with Filter Icon - Left side */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-sm">
            <Filter className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 leading-tight">Date Range Filter</h3>
            <p className="text-xs text-slate-500 font-medium">Select your preferred date range</p>
          </div>
        </div>

        {/* Date Range Picker */}
        <div className="flex-1">
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onStartDateChange={(date) => setDateRange(prev => ({ ...prev, start: date }))}
            onEndDateChange={(date) => setDateRange(prev => ({ ...prev, end: date }))}
            noWrapper={true}
            showClearButton={false}
          />
        </div>

        {/* Clear Button */}
        <div className="flex-shrink-0">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase mb-1.5 opacity-0 pointer-events-none">
            Action
          </label>
          <button
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg px-6 py-2.5 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 group"
            onClick={handleClear}
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
            Reset to Today
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentFilterBar;
