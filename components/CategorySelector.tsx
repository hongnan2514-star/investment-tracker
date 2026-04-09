// components/CategorySelector.tsx
"use client";

import React, { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import {
  IoFastFood, IoCartOutline, IoCarSportOutline, IoGameControllerOutline,
  IoMedicalOutline, IoHomeOutline, IoDocumentTextOutline, IoWalletOutline, 
  IoShirtOutline, IoWaterOutline,IoPhonePortraitOutline, IoConstructOutline,
  IoBookOutline, IoLaptopOutline, IoFitnessOutline, IoPeopleOutline,
  IoHeartOutline,IoAirplaneOutline,IoPawOutline, IoBeerOutline, IoTicketOutline, IoExtensionPuzzleOutline,
} from "react-icons/io5";
import {
  FaMoneyBillWave, FaBriefcase, FaChartLine, FaGift, FaTrophy,
  FaClock, FaHandHoldingUsd, FaPiggyBank, FaLaptopCode,
  FaGem, FaPalette, FaMobileAlt, FaWifi, FaCar, FaGraduationCap,
  FaBuilding, FaFutbol, FaUsers, FaHandshake, FaBabyCarriage,
  FaDog, FaPlane, FaUmbrellaBeach, FaTicketAlt,
  FaQuestionCircle, FaAppStoreIos
} from "react-icons/fa";
import { AiFillPhone } from "react-icons/ai"
import { TbTax } from "react-icons/tb";
import { GiLipstick } from "react-icons/gi";

export interface Category {
  name: string;
  icon: React.ReactNode;
}

// 收入分类列表 - 使用图标组件
export const INCOME_CATEGORIES: Category[] = [
  { name: '工资', icon: <FaMoneyBillWave className="text-green-600" size={24} /> },
  { name: '奖金', icon: <FaTrophy className="text-yellow-600" size={24} /> },
  { name: '加班', icon: <FaClock className="text-blue-600" size={24} /> },
  { name: '福利', icon: <FaHandHoldingUsd className="text-emerald-600" size={24} /> },
  { name: '公积金', icon: <FaPiggyBank className="text-pink-600" size={24} /> },
  { name: '兼职', icon: <FaBriefcase className="text-indigo-600" size={24} /> },
  { name: '副业', icon: <FaLaptopCode className="text-purple-600" size={24} /> },
  { name: '退税', icon: <TbTax className="text-cyan-600" size={24} /> },
  { name: '意外收入', icon: <FaGem className="text-rose-600" size={24} /> },
  { name: '红包', icon: <FaGift className="text-red-500" size={24} /> },
  { name: '其他', icon: <IoDocumentTextOutline className="text-gray-500" size={24} /> },
];

// 支出分类列表 - 使用图标组件
export const EXPENSE_CATEGORIES: Category[] = [
  { name: '餐饮', icon: <IoFastFood className="text-orange-500" size={24} /> },
  { name: '购物', icon: <IoCartOutline className="text-pink-500" size={24} /> },
  { name: '通讯', icon: <AiFillPhone className="text-green-500" size={24} /> },
  { name: '交通', icon: <IoCarSportOutline className="text-blue-500" size={24} /> },
  { name: '娱乐', icon: <IoGameControllerOutline className="text-purple-500" size={24} /> },
  { name: '医疗', icon: <IoMedicalOutline className="text-red-500" size={24} /> },
  { name: '住房', icon: <IoHomeOutline className="text-amber-600" size={24} /> },
  { name: '服饰', icon: <IoShirtOutline className="text-indigo-500" size={24} /> },
  { name: '日用', icon: <IoWaterOutline className="text-sky-500" size={24} /> },
  { name: '数码', icon: <IoPhonePortraitOutline className="text-gray-700" size={24} /> },
  { name: '美妆', icon: <GiLipstick className="text-rose-400" size={24} /> },
  { name: '护肤', icon: <FaMobileAlt className="text-emerald-500" size={24} /> },
  { name: '应用软件', icon: <FaAppStoreIos className="text-blue-600" size={24} /> },
  { name: '通讯', icon: <FaWifi className="text-green-600" size={24} /> },
  { name: '汽车', icon: <FaCar className="text-cyan-600" size={24} /> },
  { name: '学习', icon: <IoBookOutline className="text-yellow-700" size={24} /> },
  { name: '办公', icon: <IoConstructOutline className="text-gray-600" size={24} /> },
  { name: '运动', icon: <IoFitnessOutline className="text-lime-600" size={24} /> },
  { name: '社交', icon: <IoPeopleOutline className="text-pink-600" size={24} /> },
  { name: '人情', icon: <IoHeartOutline className="text-red-400" size={24} /> },
  { name: '宠物', icon: <IoPawOutline className="text-amber-600" size={24} /> },
  { name: '旅行', icon: <IoAirplaneOutline className="text-sky-600" size={24} /> },
  { name: '度假', icon: <FaUmbrellaBeach className="text-teal-500" size={24} /> },
  { name: '育儿', icon: <FaBabyCarriage className="text-pink-500" size={24} /> },
  { name: '烟酒', icon: <IoBeerOutline className="text-amber-700" size={24} /> },
  { name: '彩票', icon: <IoTicketOutline className="text-green-600" size={24} /> },
  { name: '其他', icon: <IoDocumentTextOutline className="text-gray-500" size={24} /> },
];

// ==================== 导出分类图标映射（供其他组件使用） ====================

// 收入分类 -> 图标映射表
export const INCOME_CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {};
INCOME_CATEGORIES.forEach(cat => {
  INCOME_CATEGORY_ICON_MAP[cat.name] = cat.icon;
});

// 支出分类 -> 图标映射表
export const EXPENSE_CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {};
EXPENSE_CATEGORIES.forEach(cat => {
  EXPENSE_CATEGORY_ICON_MAP[cat.name] = cat.icon;
});

/**
 * 根据收支类型和分类名称获取对应的图标组件
 * @param type 'income' 或 'expense'
 * @param category 分类名称（如 "餐饮"、"工资"）
 * @returns React 图标组件，若未找到则返回默认的 "其他" 图标
 */
export const getCategoryIcon = (type: 'income' | 'expense', category: string): React.ReactNode => {
  const map = type === 'income' ? INCOME_CATEGORY_ICON_MAP : EXPENSE_CATEGORY_ICON_MAP;
  return map[category] || <IoDocumentTextOutline className="text-gray-500" size={24} />;
};

// ==================== 组件主体 ====================

interface CategorySelectorProps {
  type: 'income' | 'expense';
  onSelect: (categoryName: string) => void;
  onClose: () => void;
}

export default function CategorySelector({ type, onSelect, onClose }: CategorySelectorProps) {
  const [search, setSearch] = useState('');
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-white dark:bg-black z-50 flex flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center p-4">
        <button
          onClick={onClose}
          className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full"
        >
          <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h2 className="text-xl font-bold ml-4 text-gray-900 dark:text-gray-100">
          选择{type === 'income' ? '收入' : '支出'}分类
        </h2>
      </div>

      {/* 搜索框 */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜索分类"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-100 dark:bg-[#1a1a1a] border-0 p-3 pl-10 rounded-3xl text-gray-900 dark:text-gray-100 outline-none"
            autoFocus
          />
        </div>
      </div>

      {/* 分类网格 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-4 gap-4">
          {filteredCategories.map(cat => (
            <button
              key={cat.name}
              onClick={() => onSelect(cat.name)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                {cat.icon}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
        {filteredCategories.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-8">未找到匹配的分类</p >
        )}
      </div>
    </div>
  );
}