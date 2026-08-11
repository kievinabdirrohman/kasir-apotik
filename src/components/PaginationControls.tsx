import React from 'react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 bg-white border-t border-slate-100 rounded-b-xl text-xs shrink-0">
      <span className="text-slate-500 font-medium">
        Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} entri
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors border border-slate-200/60 shadow-2xs cursor-pointer"
        >
          Sebelumnya
        </button>
        <span className="px-2.5 py-1 font-bold text-slate-700 bg-slate-100/80 rounded-lg border border-slate-200 text-[11px]">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors border border-slate-200/60 shadow-2xs cursor-pointer"
        >
          Selanjutnya
        </button>
      </div>
    </div>
  );
};
