import Image from "next/image";
import SummaryCard from '@/components/dashboard/SummaryCard';
import AssetPieChart from "@/components/dashboard/AssetPieChart";

export default function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-black p-4">
      <div className="max-w-md mx-auto">

        {/** 资产总览标题区 */}
        <header className="mb-6 px-2">
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">资产总览</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">您的所有资产汇总</p>
        </header>
        
        <SummaryCard />
        <div className="flex justify-between items-center mb-4 px-2">
        </div>

         { /** 资产总览圆环图 */}
        <AssetPieChart />
      </div>
    </main>
  );
}

