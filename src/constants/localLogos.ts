/**
 * 本地 Logo 映射表
 * key: 股票/基金代码（纯代码，不含 .SS/.SZ 等后缀）
 * value: 图片在 public 目录下的路径（以 / 开头）
 */
export const LOCAL_LOGO_MAP: Record<string, string> = {
  

  // ----- A股（6位数字代码）-----
  

  // ----- 基金（6位数字）-----
  

  // ----- 港股（可选）-----
  

  // 以后遇到新代码随时加一行
};

/**
 * 从可能的带后缀代码中提取纯代码
 * 例如 "600519.SS" → "600519"
 *     "00700.HK" → "00700"
 */
export function getBaseSymbol(symbol: string): string {
  return symbol.split('.')[0];
}