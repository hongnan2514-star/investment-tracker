export default function BudgetPieChartSkeleton() {
  return (
    <div className="px-2 mb-2 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-20" />
        </div>
        <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}