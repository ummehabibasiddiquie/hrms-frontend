import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "../ui/pagination";
import { PAGE_SIZE_OPTIONS } from "../../hooks/useClientPagination";

/**
 * Shared pagination footer for listing tables (matches Tracker Report style).
 */
const TablePaginationBar = ({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  pageStart,
  pageEnd,
  hasPrevious,
  hasNext,
  setPage,
  setItemsPerPage,
  pageNumbers,
  itemLabel = "records",
  className = "",
}) => {
  if (totalItems === 0) return null;

  return (
    <div
      className={`border-t border-slate-200 bg-gradient-to-r from-slate-50 via-blue-50 to-slate-50 px-4 py-4 sm:px-6 ${className}`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-white px-4 py-2.5 shadow-sm">
            <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Show</span>
            <select
              value={pageSize}
              onChange={(e) => setItemsPerPage(e.target.value)}
              className="rounded-lg border border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-1.5 text-sm font-bold text-blue-700 outline-none transition-all hover:from-blue-100 hover:to-indigo-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">entries</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm border border-slate-200">
              Showing {pageStart}-{pageEnd}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm border border-slate-200">
              {totalItems} total {itemLabel}
            </span>
            <span className="rounded-full bg-blue-600 px-3 py-1.5 font-semibold text-white shadow-sm">
              Page {currentPage} of {totalPages}
            </span>
          </div>
        </div>

        {totalPages > 1 && (
          <Pagination className="w-full justify-start xl:w-auto xl:justify-end">
            <PaginationContent className="flex-wrap justify-start gap-2 xl:justify-end">
              <PaginationItem>
                <PaginationLink
                  onClick={() => setPage(currentPage - 1)}
                  size="default"
                  className={`h-10 rounded-lg px-4 font-semibold transition-all ${
                    hasPrevious
                      ? "border-slate-300 bg-white text-slate-700 shadow-sm hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                      : "pointer-events-none border-slate-200 bg-slate-100 text-slate-400 opacity-60"
                  }`}
                >
                  Previous
                </PaginationLink>
              </PaginationItem>

              {pageNumbers.map((pageNumber) => (
                <PaginationItem key={String(pageNumber)}>
                  {String(pageNumber).startsWith("ellipsis") ? (
                    <PaginationEllipsis className="text-slate-500" />
                  ) : (
                    <PaginationLink
                      onClick={() => setPage(pageNumber)}
                      isActive={currentPage === pageNumber}
                      className={`h-10 min-w-[40px] rounded-lg font-bold transition-all ${
                        currentPage === pageNumber
                          ? "border-blue-400 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                          : "border-slate-300 bg-white text-slate-700 shadow-sm hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      {pageNumber}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationLink
                  onClick={() => setPage(currentPage + 1)}
                  size="default"
                  className={`h-10 rounded-lg px-4 font-semibold transition-all ${
                    hasNext
                      ? "border-slate-300 bg-white text-slate-700 shadow-sm hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                      : "pointer-events-none border-slate-200 bg-slate-100 text-slate-400 opacity-60"
                  }`}
                >
                  Next
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
};

export default TablePaginationBar;
