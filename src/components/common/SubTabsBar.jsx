import React from "react";

/**
 * Shared sub-tab bar — Overview / Analytics style.
 * Equal-width tabs, bold labels, gradient bottom underline.
 */
const SubTabsBar = ({
  tabs = [],
  activeTab,
  onChange,
  className = "",
  /** Wrap in white rounded card (default true for Overview look). */
  bordered = true,
  /** Stretch tabs evenly across the row (default true). */
  equalWidth = true,
  /** Tighter tabs for data-heavy views (e.g. daily report). */
  compact = false,
  listClassName = "",
}) => {
  const visibleTabs = tabs.filter((tab) => tab && !tab.hidden);

  if (visibleTabs.length === 0) return null;

  const list = (
    <div
      className={`flex overflow-x-auto border-b border-slate-200 scrollbar-hide ${listClassName}`}
      role="tablist"
    >
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const disabled = Boolean(tab.disabled);
        const shortLabel = tab.shortLabel || (tab.label ? String(tab.label).split(" ")[0] : "");

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => {
              if (!disabled && onChange) onChange(tab.id);
            }}
            className={`px-6 ${compact ? "py-2" : "py-4"} text-sm font-bold transition-all relative whitespace-nowrap ${
              equalWidth || tab.flex ? "flex-1 min-w-fit" : ""
            } ${
              isActive
                ? "text-blue-600 bg-blue-50"
                : disabled
                ? "text-slate-400 bg-slate-50 cursor-not-allowed"
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{shortLabel}</span>
              {tab.badge != null && tab.badge !== "" ? (
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                    isActive ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {tab.badge}
                </span>
              ) : null}
            </div>
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
            )}
          </button>
        );
      })}
    </div>
  );

  if (bordered) {
    return (
      <div
        className={`bg-white ${compact ? "rounded-xl shadow-md mb-2" : "rounded-2xl shadow-lg mb-6"} border border-slate-200 overflow-hidden ${className}`}
      >
        {list}
      </div>
    );
  }

  return <div className={className}>{list}</div>;
};

export default SubTabsBar;
