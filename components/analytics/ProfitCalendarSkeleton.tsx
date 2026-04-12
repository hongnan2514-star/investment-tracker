export default function ProfitCalendarSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md mb-4 animate-pulse">
      {/* 头部 */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      </div>
      {/* 星期缩写 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['日','一','二','三','四','五','六'].map((_, i) => (
          <div key={i} className="h-4 w-6 mx-auto bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square flex flex-col items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
            <div className="h-4 w-5 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
            <div className="h-3 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
      <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded mx-auto mt-3" />
    </div>
  );
}