import { PaginateOptions, PaginationData, PaginationResult } from "../variables/types";

export async function paginate<T>(
  model: any,                        // The Mongoose model
  filter: Record<string, any>,       // Query filter
  paginationData: PaginationData,    // Page, size, sort
  options: PaginateOptions = {}      // Optional: projection, populate, lean
): Promise<PaginationResult<T>> {

  const DEFAULT_PAGE = 1;
  const DEFAULT_SIZE = 10;
  const DEFAULT_SORT: Record<string, 1 | -1> = { createdAt: -1 };

  const limit = paginationData.size && paginationData.size > 0 ? paginationData.size : DEFAULT_SIZE;
  const page = paginationData.page && paginationData.page > 0 ? paginationData.page : DEFAULT_PAGE;
  const skip = (page - 1) * limit;
  // An empty object is truthy, so `sort: {}` used to defeat DEFAULT_SORT and
  // fall back to natural order — which reorders as documents are updated, so
  // paging through a list duplicated and skipped rows.
  const requestedSort = paginationData.sort;
  const sort = requestedSort && Object.keys(requestedSort).length > 0
    ? { ...requestedSort }
    : DEFAULT_SORT;

  let query = model.find(filter, options.projection || {});

  // Apply lean first
  if (options.lean !== false) {
    query = query.lean({ getters: true });
  }

  // Then populate
  if (options.populate) {
    // Handle both single and array of populates
    if (Array.isArray(options.populate)) {
      options.populate.forEach(pop => {
        query = query.populate(pop);
      });
    } else {
      query = query.populate(options.populate);
    }
  }

  const [data, counter] = await Promise.all([
    query.skip(skip).limit(limit).sort(sort),
    model.countDocuments(filter)
  ]);

  return {
    data,
    currentPage: page,
    totalCount: counter,
    totalPage: Math.ceil(counter / limit)
  };
}