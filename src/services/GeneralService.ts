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
  const sort = paginationData.sort ? { ...paginationData.sort } : DEFAULT_SORT;

  let query = model.find(filter, options.projection || {});

  if (options.populate) {
    query = query.populate(options.populate);
  }
  if (options.lean !== false) {   // default true
    query = query.lean({ getters: true });
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