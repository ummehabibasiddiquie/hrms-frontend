import { useEffect, useMemo, useState } from "react";

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = [1];
  if (currentPage > 3) pages.push("ellipsis-start");

  const middleStart = Math.max(2, currentPage - 1);
  const middleEnd = Math.min(totalPages - 1, currentPage + 1);
  for (let page = middleStart; page <= middleEnd; page += 1) {
    if (!pages.includes(page)) pages.push(page);
  }

  if (currentPage < totalPages - 2) pages.push("ellipsis-end");
  if (!pages.includes(totalPages)) pages.push(totalPages);
  return pages;
}

/**
 * Client-side pagination for listing pages (all data already loaded).
 * Resets to page 1 when resetKeys change (search/filter).
 */
export function useClientPagination(items, options = {}) {
  const {
    initialPageSize = DEFAULT_PAGE_SIZE,
    resetKeys = [],
  } = options;

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const list = Array.isArray(items) ? items : [];
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);

  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, totalItems, ...resetKeys]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [list, currentPage, pageSize]);

  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, totalItems);

  const setPage = (page) => {
    const next = Math.max(1, Math.min(Number(page) || 1, totalPages));
    if (next !== currentPage) setCurrentPage(next);
  };

  const setItemsPerPage = (value) => {
    const next = Number(value) || initialPageSize;
    setPageSize(next);
    setCurrentPage(1);
  };

  return {
    pagedItems,
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    pageStart,
    pageEnd,
    hasPrevious: currentPage > 1,
    hasNext: currentPage < totalPages,
    setPage,
    setItemsPerPage,
    pageNumbers: getPageNumbers(currentPage, totalPages),
  };
}
