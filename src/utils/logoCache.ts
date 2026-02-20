/**
 * 将远程图片URL转换为Base64并缓存到localStorage
 * @param symbol 资产唯一标识（用于缓存键）
 * @param imageUrl 图片URL
 */
export async function cacheLogo(symbol: string, imageUrl: string): Promise<void> {
  if (!imageUrl || typeof window === 'undefined') return;

  try {
    // 从远程获取图片
    const response = await fetch(imageUrl, { mode: 'cors' });
    if (!response.ok) throw new Error('图片获取失败');

    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // 存入localStorage，添加前缀避免冲突
    localStorage.setItem(`logo_${symbol}`, base64);
    console.log(`[Logo缓存] 已缓存 ${symbol}`);
  } catch (error) {
    console.warn(`[Logo缓存] 缓存失败 ${symbol}:`, error);
  }
}

/**
 * 从本地缓存获取Logo的Base64数据
 * @param symbol 资产唯一标识
 * @returns Base64字符串（若存在），否则返回null
 */
export function getCachedLogo(symbol: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`logo_${symbol}`);
}

/**
 * 删除指定资产的Logo缓存
 * @param symbol 资产唯一标识
 */
export function removeCachedLogo(symbol: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`logo_${symbol}`);
}