import type { PharmacySettings } from '../types';

export const DEFAULT_PRINTER_SETTINGS = {
  marginTopMm: 0,
  marginRightMm: 0,
  marginBottomMm: 0,
  marginLeftMm: 0,
  fontSize: 7,
  lineHeight: 1.2,
  labelWidthPct: 56,
  columnGapMm: 2,
  amountAlignment: 'right' as const,
};

export type PrinterLayoutSettings = {
  paperWidth: '58mm' | '80mm';
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  fontSize: number;
  lineHeight: number;
  labelWidthPct: number;
  columnGapMm: number;
  amountAlignment: 'left' | 'right';
};

const clamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizePrinterSettings(settings: PharmacySettings, paperWidth = settings.paperWidth || '58mm'): PrinterLayoutSettings {
  const defaultFont = DEFAULT_PRINTER_SETTINGS.fontSize;
  return {
    paperWidth: paperWidth === '80mm' ? '80mm' as const : '58mm' as const,
    marginTopMm: clamp(Number(settings.marginTopMm), 0, 10, DEFAULT_PRINTER_SETTINGS.marginTopMm),
    marginRightMm: clamp(Number(settings.marginRightMm), 0, 10, DEFAULT_PRINTER_SETTINGS.marginRightMm),
    marginBottomMm: clamp(Number(settings.marginBottomMm), 0, 10, DEFAULT_PRINTER_SETTINGS.marginBottomMm),
    marginLeftMm: clamp(Number(settings.marginLeftMm), 0, 10, DEFAULT_PRINTER_SETTINGS.marginLeftMm),
    fontSize: clamp(Number(settings.printerFontSize), 7, 18, defaultFont),
    lineHeight: clamp(Number(settings.printerLineHeight), 1, 2, DEFAULT_PRINTER_SETTINGS.lineHeight),
    labelWidthPct: clamp(Number(settings.printerLabelWidthPct), 35, 70, DEFAULT_PRINTER_SETTINGS.labelWidthPct),
    columnGapMm: clamp(Number(settings.printerColumnGapMm), 0, 12, DEFAULT_PRINTER_SETTINGS.columnGapMm),
    amountAlignment: settings.printerAmountAlignment === 'left' ? 'left' as const : 'right' as const,
  };
}
