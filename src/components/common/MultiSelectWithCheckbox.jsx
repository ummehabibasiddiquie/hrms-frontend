import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, CheckSquare, Square } from 'lucide-react';

/**
 * MultiSelectWithCheckbox - A multi-select dropdown with checkboxes, search, and select all
 * @param {array} value - Array of selected values
 * @param {function} onChange - Callback when selection changes
 * @param {array} options - Array of {value, label} objects
 * @param {Component} icon - Lucide icon component
 * @param {string} placeholder - Placeholder text
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Disable the dropdown
 * @param {boolean} showSelectAll - Show select all checkbox
 * @param {boolean} error - Show error state
 * @param {string} errorMessage - Error message to display
 * @param {number} maxDisplayCount - Kept for backward compatibility (no longer used)
 */
const MultiSelectWithCheckbox = ({ 
  value = [], 
  onChange, 
  options = [], 
  icon: Icon, 
  placeholder = "Select...",
  className = "",
  disabled = false,
  showSelectAll = true,
  error = false,
  errorMessage = "",
  maxDisplayCount: _maxDisplayCount = 3 // eslint-disable-line
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const buttonRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    
    const handleResize = () => {
      if (isOpen) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);

    window.addEventListener('resize', handleResize);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Use viewport coordinates directly since dropdown is fixed positioned
      
      
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  // Filter options based on search term
  const filteredOptions = options.filter(opt => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return opt.label?.toLowerCase().includes(searchLower) || 
           opt.value?.toString().toLowerCase().includes(searchLower);
  });

  const selectedOptions = options.filter(opt => value.includes(opt.value));
  const allFilteredSelected = filteredOptions.length > 0 && 
    filteredOptions.every(opt => value.includes(opt.value));

  const handleToggle = (optionValue) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered options
      const filteredValues = filteredOptions.map(opt => opt.value);
      onChange(value.filter(v => !filteredValues.includes(v)));
    } else {
      // Select all filtered options
      const newValues = [...new Set([...value, ...filteredOptions.map(opt => opt.value)])];
      onChange(newValues);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange([]);
    setSearchTerm('');
  };

  // Display text - truncate to first 7 characters
  const getDisplayText = () => {
    if (selectedOptions.length === 0) return placeholder;
    const fullText = selectedOptions.map(opt => opt.label).join(', ');
    if (fullText.length <= 7) return fullText;
    return fullText.substring(0, 7) + '...';
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Main Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            setIsOpen(prev => !prev);
          }
        }}
        onMouseEnter={() => selectedOptions.length > 0 && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={disabled}
        className={`
          relative flex items-center bg-slate-50 rounded-lg border-2 transition-all w-full px-3 py-2.5 outline-none shadow-sm
          ${error 
            ? 'border-red-500 focus:ring-2 focus:ring-red-200' 
            : disabled 
              ? 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-60' 
              : 'border-blue-200 hover:bg-blue-50 hover:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:border-blue-500'
          }
        `}
      >
        {Icon && <Icon className="w-4 h-4 text-blue-600 mr-2.5 shrink-0" />}
        <span className={`text-sm font-medium flex-1 text-left ${
          selectedOptions.length > 0 ? 'text-slate-800' : 'text-slate-400'
        }`}>
          {getDisplayText()}
        </span>
        {value.length > 0 && !disabled && (
          <span
            onClick={handleClear}
            className="p-0.5 hover:bg-slate-200 rounded-full transition-colors mr-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-slate-500" />
          </span>
        )}
        <ChevronDown 
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Tooltip with Selected Items as Badges */}
      {showTooltip && selectedOptions.length > 0 && !isOpen && (
        <div 
          className="absolute z-[9999] left-0 top-full mt-0.5 bg-white rounded-lg shadow-xl border-2 border-blue-200 p-3 min-w-full max-w-4xl max-h-96 overflow-y-auto"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="flex flex-wrap gap-2">
            {selectedOptions.map((option, idx) => (
              <span
                key={option.value ?? idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium border border-blue-200"
              >
                {option.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && errorMessage && (
        <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" x2="12" y1="8" y2="12"></line>
            <line x1="12" x2="12.01" y1="16" y2="16"></line>
          </svg>
          {errorMessage}
        </p>
      )}

      {/* Dropdown Menu - Rendered via Portal */}
      {isOpen && !disabled && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed bg-white rounded-lg shadow-2xl border-2 border-blue-400 py-1 max-h-80 overflow-hidden flex flex-col min-w-[250px]"
          style={{
            zIndex: 99999,
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`
          }}
        >
          {/* Search Input */}
          <div className="px-3 py-2 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Select All */}
          {showSelectAll && filteredOptions.length > 0 && (
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={handleSelectAll}
                className="w-full flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                {allFilteredSelected ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>{allFilteredSelected ? 'Deselect All' : 'Select All'}</span>
                {filteredOptions.length < options.length && (
                  <span className="text-slate-400">({filteredOptions.length})</span>
                )}
              </button>
            </div>
          )}

          {/* Options List */}
          <div 
            className="overflow-y-auto max-h-60"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = value.includes(option.value);
                return (
                  <button
                    key={option.value ?? idx}
                    type="button"
                    onClick={() => handleToggle(option.value)}
                    className={`
                      w-full px-4 py-2.5 text-left text-sm flex items-center gap-2
                      transition-all hover:bg-blue-50 hover:text-blue-700
                      ${isSelected ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600' : 'text-slate-700 font-medium'}
                    `}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                    <span className={isSelected ? 'font-medium' : ''}>
                      {option.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer with selected count */}
          {selectedOptions.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
              <span className="font-semibold">{selectedOptions.length}</span> of{' '}
              <span className="font-semibold">{options.length}</span> selected
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default MultiSelectWithCheckbox;
