import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

/**
 * SearchableSelect - A dropdown with search functionality
 * @param {string} value - Selected value
 * @param {function} onChange - Callback when selection changes
 * @param {array} options - Array of {value, label} objects
 * @param {Component} icon - Lucide icon component
 * @param {string} placeholder - Placeholder text
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Disable the dropdown
 * @param {boolean} isClearable - Show clear button
 * @param {boolean} error - Show error state
 * @param {string} errorMessage - Error message to display
 */
const SearchableSelect = ({ 
  value, 
  onChange, 
  options = [], 
  icon: Icon, 
  placeholder = "Select...",
  className = "",
  disabled = false,
  isClearable = true,
  error = false,
  errorMessage = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    
    const handleScroll = (event) => {
      if (isOpen) {
        // Check if scroll is happening within the dropdown
        const scrollingElement = event.target;
        const isDropdownScroll = dropdownRef.current?.contains(scrollingElement);
        
        // Only close if scrolling outside the dropdown
        if (!isDropdownScroll) {
          setIsOpen(false);
          setSearchTerm('');
        }
      }
    };
    
    const handleResize = () => {
      if (isOpen) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter options based on search term
  const filteredOptions = options.filter(opt => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return opt.label?.toLowerCase().includes(searchLower) || 
           opt.value?.toString().toLowerCase().includes(searchLower);
  });

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  // Truncate display text to first 7 characters
  const getTruncatedText = (text) => {
    if (!text) return placeholder;
    if (text.length <= 7) return text;
    return text.substring(0, 7) + '...';
  };

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {/* Main Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            setIsOpen(prev => !prev);
          }
        }}
        onMouseEnter={() => selectedOption?.label && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={disabled}
        className={`
          relative flex items-center bg-slate-50 rounded-lg border transition-all w-full px-3 py-2.5 outline-none shadow-sm hover:bg-white
          ${error 
            ? 'border-red-500 focus:ring-2 focus:ring-red-200' 
            : disabled 
              ? 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-60' 
              : 'border-slate-300 hover:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:border-blue-500'
          }
        `}
      >
        {Icon && <Icon className="w-4 h-4 text-blue-600 mr-2.5 shrink-0" />}
        <span className={`text-sm font-medium flex-1 text-left ${
          selectedOption?.label ? 'text-slate-800' : 'text-slate-400'
        }`}>
          {getTruncatedText(selectedOption?.label)}
        </span>
        {isClearable && value && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClear(e);
              }
            }}
            className="p-0.5 hover:bg-slate-200 rounded-full transition-colors mr-1 cursor-pointer inline-flex items-center justify-center"
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
      {/* Tooltip with Selected Item */}
      {showTooltip && selectedOption?.label && !isOpen && (
        <div 
          className="absolute z-[9999] left-0 top-full mt-0.5 bg-white rounded-lg shadow-xl border-2 border-blue-200 p-3 min-w-full max-w-md max-h-96 overflow-y-auto"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium border border-blue-200">
            {selectedOption.label}
          </span>
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

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div 
          className="fixed bg-white rounded-lg shadow-2xl border-2 border-blue-400 py-1 max-h-80 overflow-hidden flex flex-col min-w-[250px]"
          style={{
            zIndex: 9999,
            top: dropdownRef.current?.getBoundingClientRect().bottom + 8 + 'px',
            left: dropdownRef.current?.getBoundingClientRect().left + 'px',
            width: dropdownRef.current?.getBoundingClientRect().width + 'px'
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

          {/* Options List */}
          <div className="overflow-y-auto max-h-60">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const uniqueKey = option.value !== undefined && option.value !== null && option.value !== '' 
                  ? `option-${option.value}` 
                  : `option-idx-${idx}`;
                return (
                  <button
                    key={uniqueKey}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`
                      w-full px-4 py-2.5 text-left text-sm flex items-center justify-between
                      transition-all hover:bg-blue-50 hover:text-blue-700
                      ${value === option.value ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600' : 'text-slate-700 font-medium'}
                    `}
                  >
                    <span>{option.label}</span>
                    {value === option.value && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
