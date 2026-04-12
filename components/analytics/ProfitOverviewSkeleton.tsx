export default function ProfitOverviewSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 mb-4 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i}>
            <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
            <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}