export const buildListOptions = (
  query,
  { sortableFields, defaultSort, defaultOrder = 'asc', maxLimit = 100 }
) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requestedLimit = Number.parseInt(query.limit, 10) || 10;
  const limit = Math.min(maxLimit, Math.max(1, requestedLimit));
  const sortField = sortableFields.includes(query.sort) ? query.sort : defaultSort;
  const order = query.order === 'asc' || query.order === 'desc' ? query.order : defaultOrder;
  const sortOrder = order === 'desc' ? -1 : 1;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sort: sortField === '_id' ? { _id: sortOrder } : { [sortField]: sortOrder, _id: sortOrder }
  };
};

export const buildPaginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit))
});
