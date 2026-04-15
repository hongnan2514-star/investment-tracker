// src/constants/type.ts
export interface Asset {
  symbol: string;
  name: string;
  price: number;
  holdings: number;
  marketValue: number;
  currency: string;
  lastUpdated: string;
  type: string;
  changePercent: number;
  logoUrl?: string;
  purchaseDate?: string;
  costPrice?: number;
  notes?: string;
  includeInChart?: boolean;
  yesterday_close_value?: number | null;
}