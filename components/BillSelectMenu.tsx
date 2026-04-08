// components/BillSelectMenu.tsx
"use client";

import React from 'react';

interface BillSelectMenuProps {
  show: boolean;
  onClose: () => void;
  onSelect: () => void;
}

export default function BillSelectMenu({ show, onClose, onSelect }: BillSelectMenuProps) {
  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-4 top-20 z-50 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 w-[160px] sm:min-w-[200px] max-w-[90vw]">
        <button
          onClick={() => {
            onSelect();
            onClose();
          }}
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-gray-100 font-medium"
        >
          选择账单
        </button>
      </div>
    </>
  );
}