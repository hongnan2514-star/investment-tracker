export default function LedgerSummarySkeleton() {
  return (
    <div className="flex items-center gap-3 mb-6 px-2 animate-pulse">
      <div className="flex flex-col shrink-0">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2" />
        <div className="flex items-center gap-0 mt-0.5">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full ml-1" />
        </div>
      </div>
      <div className="w-px h-12 bg-gray-300 dark:bg-gray-700 self-center" />
      <div className="flex-1">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-1" />
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
          <div className="flex justify-between">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}