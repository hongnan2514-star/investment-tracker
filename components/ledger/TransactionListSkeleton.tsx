export default function TransactionListSkeleton() {
  return (
    <div className="space-y-3 mb-20">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white dark:bg-[#0a0a0a] rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-800 animate-pulse">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 mt-1" />
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-24 mt-1" />
              </div>
            </div>
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
          <div className="mt-2 h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 ml-auto" />
        </div>
      ))}
    </div>
  );
}