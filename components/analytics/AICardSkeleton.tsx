import { AlertCircle } from 'lucide-react';

export default function AICardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 shadow-md mb-4 animate-pulse">
      <div className="flex items-start gap-2">
        <AlertCircle size={20} className="text-blue-600/30 dark:text-blue-400/30 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        </div>
      </div>
    </div>
  );
}