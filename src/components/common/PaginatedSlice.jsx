import React from "react";
import { useClientPagination } from "../../hooks/useClientPagination";
import TablePaginationBar from "./TablePaginationBar";

/**
 * Wraps a list with client-side pagination. Use inside loops (e.g. per-month tables).
 */
const PaginatedSlice = ({
  items,
  resetKeys = [],
  itemLabel = "records",
  children,
  showBar = true,
  paginationClassName = "",
}) => {
  const pagination = useClientPagination(items, { resetKeys });

  return (
    <>
      {children(pagination.pagedItems, pagination)}
      {showBar && (
        <TablePaginationBar
          {...pagination}
          itemLabel={itemLabel}
          className={paginationClassName}
        />
      )}
    </>
  );
};

export default PaginatedSlice;
