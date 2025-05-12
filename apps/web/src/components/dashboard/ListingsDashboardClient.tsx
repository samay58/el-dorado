'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  PaginationState,
  ColumnFiltersState,
  CellContext,
  Row,
  HeaderGroup,
  Cell,
  Header,
} from '@tanstack/react-table';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { FilterDrawer, ListingFilters } from './FilterDrawer';
import clsx from 'clsx';

// Updated placeholder types to better match observed API response
interface ListingJsonData {
  address?: string; // Changed from object to string, made optional
  listPrice?: number; // Keep as optional, may not be in all records
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number; 
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  /** Medium-sized main photo returned in Zillow JSON (e.g. https://photos.zillowstatic.com/…/p_e.jpg) */
  property_image?: string;
}
interface ScoreData {
  alignmentScore: number;
  missingMusts: string[];
  matchedCriteriaKeys: string[];
  locationBonus: number;
  scoredAt: string; // Date as string from API
}
interface Listing {
  extId: string;
  site: string; // e.g., 'ZILLOW'
  url: string;
  capturedAt: string; // Date as string from API
  jsonData: ListingJsonData;
  scoreData?: ScoreData;
}
interface ApiListingsResponse {
  listings: Listing[];
  totalListings: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

// Construct API base URL from env (default localhost dev server)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

async function fetchListingsAPI(params: URLSearchParams): Promise<ApiListingsResponse> {
  const response = await fetch(`${API_BASE_URL}/listings?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch listings' }));
    throw new Error(errorData.message || 'Failed to fetch listings');
  }
  return response.json();
}

export default function ListingsDashboardClient() {
  const [data, setData] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'capturedAt', desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0, // TanStack Table is 0-indexed for pageIndex
    pageSize: 20,
  });
  const [totalRows, setTotalRows] = useState(0);
  const [filterMinPrice, setFilterMinPrice] = useState<string>('');
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>('');
  const [filterMinBeds, setFilterMinBeds] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch data when pagination, sorting, or filters change
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('page', (pagination.pageIndex + 1).toString());
      params.append('limit', pagination.pageSize.toString());
      
      // Corrected handling of sorting array
      if (sorting && sorting.length > 0) {
        const firstSort = sorting[0];
        if (firstSort && allowedSortIds.includes(firstSort.id)) {
          params.append('sortBy', firstSort.id);
          params.append('sortOrder', firstSort.desc ? 'desc' : 'asc');
        }
      }
      if (filterMinPrice) params.append('minPrice', filterMinPrice);
      if (filterMaxPrice) params.append('maxPrice', filterMaxPrice);
      if (filterMinBeds) params.append('minBeds', filterMinBeds);

      try {
        const result = await fetchListingsAPI(params);
        setData(result.listings);
        setTotalRows(result.totalListings);
        // TanStack table pageCount is derived, or you can set it if API provides totalPages
        // For manual pagination server-side, you need totalPages or totalRows
      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred');
      }
      setIsLoading(false);
    };
    fetchData();
  }, [pagination, sorting, columnFilters, filterMinPrice, filterMaxPrice, filterMinBeds]);

  const allowedSortIds = ['capturedAt', 'alignmentScore'];

  const columns = useMemo<ColumnDef<Listing>[]>(() => [
    {
      id: 'photo',
      header: '', // icon-less header keeps table compact
      accessorFn: (row: Listing) => row.jsonData.property_image,
      cell: (info: CellContext<Listing, any>) => {
        const src = info.getValue() as string | undefined;
        return src ? (
          <img
            src={src}
            alt="Listing thumbnail"
            className="w-24 h-16 object-cover rounded-md border border-neutral-700"
          />
        ) : null;
      },
      enableSorting: false,
      size: 110, // keep column narrow
      meta: { sticky: true }, // future column-visibility handling
    },
    {
      header: 'Address',
      accessorKey: 'jsonData.address', // Access the address string directly
      cell: (info: CellContext<Listing, any>) => {
        const value = info.getValue() as string | undefined;
        return String(value || 'N/A');
      },
      enableSorting: false,
    },
    {
      id: 'listPrice',
      header: 'Price',
      accessorFn: (row: Listing) => row.jsonData.listPrice, 
      cell: (info: CellContext<Listing, any>) => {
        const price = info.getValue() as number | undefined;
        return price ? `$${price.toLocaleString()}` : 'N/A';
      },
      enableSorting: false,
    },
    {
      header: 'Beds',
      accessorFn: (row: Listing) => row.jsonData.bedrooms,
      cell: (info: CellContext<Listing, any>) => {
        const value = info.getValue() as number | undefined;
        return value !== undefined ? value : 'N/A';
      },
      enableSorting: false,
    },
    {
      header: 'Baths',
      accessorFn: (row: Listing) => row.jsonData.bathrooms,
      cell: (info: CellContext<Listing, any>) => {
        const value = info.getValue() as number | undefined;
        return value !== undefined ? value : 'N/A';
      }
    },
    {
      header: 'SqFt',
      accessorFn: (row: Listing) => row.jsonData.livingArea,
      cell: (info: CellContext<Listing, any>) => {
        const value = info.getValue() as number | undefined;
        return value !== undefined ? value.toLocaleString() : 'N/A';
      }
    },
    {
      header: 'Alignment',
      accessorFn: (row: Listing) => row.scoreData?.alignmentScore,
      cell: (info: CellContext<Listing, any>) => {
        const score = info.getValue() as number | undefined;
        if (score === undefined) return 'N/A';
        let bg = 'bg-red-800/40';
        if (score >= 80) bg = 'bg-green-600/40';
        else if (score >= 60) bg = 'bg-green-500/30';
        else if (score >= 40) bg = 'bg-yellow-600/40';
        return (
          <span className={clsx('px-2 py-1 rounded text-xs font-semibold text-white', bg)}>
            {score.toFixed(0)}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      header: 'Captured At',
      accessorFn: (row: Listing) => row.capturedAt,
      cell: (info: CellContext<Listing, any>) => {
        const value = info.getValue() as string | undefined;
        return value ? new Date(value).toLocaleDateString() : 'N/A';
      }
    },
    {
        id: 'actions',
        header: 'Link',
        cell: ({ row }: CellContext<Listing, any>) => <a href={row.original.url} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-300">View</a>
    }
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
      columnFilters,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true, // Crucial for server-side pagination
    manualSorting: true,    // Crucial for server-side sorting
    manualFiltering: true,  // Crucial for server-side filtering
    pageCount: Math.ceil(totalRows / pagination.pageSize), // Calculate pageCount from totalRows
    // debugTable: true,
  });

  if (error) {
    return <div className="text-red-500 p-4 bg-red-900/20 rounded-md">Error fetching listings: {error}</div>;
  }

  return (
    <div className="bg-neutral-800 shadow-xl rounded-lg p-6">
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => setShowFilters(true)}>
          Filters
        </Button>
      </div>

      <FilterDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        initial={{ minPrice: filterMinPrice, maxPrice: filterMaxPrice, minBeds: filterMinBeds }}
        onApply={(f: ListingFilters) => {
          setFilterMinPrice(f.minPrice ?? '');
          setFilterMaxPrice(f.maxPrice ?? '');
          setFilterMinBeds(f.minBeds ?? '');
          // Reset to first page when filters change
          setPagination((p) => ({ ...p, pageIndex: 0 }));
        }}
      />
      
      {isLoading && (
        <div className="text-center py-8">
          <p className="text-lg text-neutral-400">Loading listings data...</p>
          {/* Add a spinner or more sophisticated skeleton loader here */}
        </div>
      )}

      {!isLoading && data.length === 0 && (
         <div className="text-center py-8">
            <p className="text-lg text-neutral-400">No listings found matching your criteria.</p>
        </div>
      )}

      {!isLoading && data.length > 0 && (
        <>
          <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
            <thead className="bg-neutral-100 dark:bg-neutral-700/50 sticky top-0 z-10">
              {/* Light mode header */}
              {table.getHeaderGroups().map((headerGroup: HeaderGroup<Listing>) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header: Header<Listing, any>) => (
                    <th
                      key={header.id}
                      scope="col"
                      tabIndex={header.column.getCanSort() ? 0 : -1}
                      role={header.column.getCanSort() ? 'button' : undefined}
                      aria-sort={header.column.getIsSorted() ? (header.column.getIsSorted() === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer select-none"
                      onClick={header.column.getToggleSortingHandler()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          header.column.getToggleSortingHandler()?.(e as any);
                        }
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: ' 🔼',
                        desc: ' 🔽',
                      }[header.column.getIsSorted() as string] ?? null}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white dark:bg-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-700">
              {table.getRowModel().rows.map((row: Row<Listing>) => (
                <tr key={row.id} className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700/30 even:bg-white odd:bg-neutral-50 dark:even:bg-neutral-800 dark:odd:bg-neutral-850 focus-within:bg-neutral-50 dark:focus-within:bg-neutral-700/40">
                  {row.getVisibleCells().map((cell: Cell<Listing, any>) => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 dark:text-neutral-200">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          <div className="py-4 flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
                <Button variant="secondary" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="relative inline-flex items-center px-4 py-2 border border-neutral-600 text-sm font-medium rounded-md text-neutral-300 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50">
                    Previous
                </Button>
                <Button variant="secondary" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="ml-3 relative inline-flex items-center px-4 py-2 border border-neutral-600 text-sm font-medium rounded-md text-neutral-300 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50">
                    Next
                </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-neutral-400">
                        Showing <span className="font-medium">{table.getRowModel().rows.length}</span> of <span className="font-medium">{totalRows}</span> results
                    </p>
                </div>
                <div>
                    <div className="flex items-center justify-between gap-2">
                        <Button variant="secondary" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                            Previous
                        </Button>
                        <span className="text-sm">Page {pagination.pageIndex + 1}</span>
                        <Button variant="secondary" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                            Next
                        </Button>
                    </div>
                </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 