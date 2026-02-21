// /app/api/data-sources/juhe-car.ts
import { DataSourceResult } from "./types";

const JUHE_CAR_KEY = process.env.JUHE_CAR_KEY;
console.log('🔑 JUHE_CAR_KEY from env:', process.env.JUHE_CAR_KEY);

// 缓存结构
interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

// 内存缓存
const cache: {
  brands?: CacheItem<any[]>;
  series: Map<string, CacheItem<any[]>>;
  models: Map<string, CacheItem<any[]>>;
} = {
  series: new Map(),
  models: new Map(),
};

// 缓存时间：品牌7天，车系/车型1天（毫秒）
const BRANDS_TTL = 7 * 24 * 60 * 60 * 1000;
const SERIES_TTL = 24 * 60 * 60 * 1000;
const MODELS_TTL = 24 * 60 * 60 * 1000;

/**
 * 获取汽车品牌列表
 */
export async function getCarBrands(): Promise<DataSourceResult> {
  if (!JUHE_CAR_KEY) {
    return { success: false, data: null, error: '聚合汽车 key 未配置', source: 'JuheCar' };
  }

  // 检查缓存
  if (cache.brands && cache.brands.expiresAt > Date.now()) {
    console.log('[聚合汽车] 使用缓存品牌列表');
    return { success: true, data: cache.brands.data as any, source: 'JuheCar (cached)' };
  }

  try {
    const url = `http://apis.juhe.cn/cxdq/brand?key=${JUHE_CAR_KEY}`;
    console.log(`[聚合汽车] 请求品牌列表: ${url}`);
    const res = await fetch(url);
    const data = await res.json();

    if (data.error_code !== 0) {
      return { success: false, data: null, error: data.reason || '获取品牌失败', source: 'JuheCar' };
    }

    // 确保 result 是数组，若不是则视为空数组
    const resultArray = Array.isArray(data.result) ? data.result : [];
    const brands = resultArray.map((item: any) => ({
      id: item.id,
      name: item.brand_name,
      logoUrl: item.brand_logo,
    }));

    cache.brands = { data: brands, expiresAt: Date.now() + BRANDS_TTL };
    return { success: true, data: brands as any, source: 'JuheCar' };
  } catch (error: any) {
    console.error('[聚合汽车] 品牌列表异常:', error);
    return { success: false, data: null, error: error.message, source: 'JuheCar' };
  }
}

/**
 * 根据品牌ID获取车系列表
 */
export async function getCarSeries(brandId: string): Promise<DataSourceResult> {
  if (!JUHE_CAR_KEY) {
    return { success: false, data: null, error: '聚合汽车 key 未配置', source: 'JuheCar' };
  }

  // 检查缓存
  const cached = cache.series.get(brandId);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[聚合汽车] 使用缓存车系 brandId=${brandId}`);
    return { success: true, data: cached.data as any, source: 'JuheCar (cached)' };
  }

  try {
    const url = `http://apis.juhe.cn/cxdq/series?brand_id=${brandId}&key=${JUHE_CAR_KEY}`;
    console.log(`[聚合汽车] 请求车系列表: ${url}`);
    const res = await fetch(url);
    const data = await res.json();

    if (data.error_code !== 0) {
      return { success: false, data: null, error: data.reason || '获取车系失败', source: 'JuheCar' };
    }

    // 确保 result 是数组，若不是则视为空数组
    const resultArray = Array.isArray(data.result) ? data.result : [];
    const series = resultArray.map((item: any) => ({
      id: item.id,
      name: item.series_name, // 根据实际返回调整字段名
    }));

    cache.series.set(brandId, { data: series, expiresAt: Date.now() + SERIES_TTL });
    return { success: true, data: series as any, source: 'JuheCar' };
  } catch (error: any) {
    console.error('[聚合汽车] 车系列表异常:', error);
    return { success: false, data: null, error: error.message, source: 'JuheCar' };
  }
}

/**
 * 根据车系ID获取车型列表
 */
export async function getCarModels(seriesId: string): Promise<DataSourceResult> {
  if (!JUHE_CAR_KEY) {
    return { success: false, data: null, error: '聚合汽车 key 未配置', source: 'JuheCar' };
  }

  const cached = cache.models.get(seriesId);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[聚合汽车] 使用缓存车型 seriesId=${seriesId}`);
    return { success: true, data: cached.data as any, source: 'JuheCar (cached)' };
  }

  try {
    const url = `http://apis.juhe.cn/cxdq/model?series_id=${seriesId}&key=${JUHE_CAR_KEY}`;
    console.log(`[聚合汽车] 请求车型列表: ${url}`);
    const res = await fetch(url);
    const data = await res.json();

    if (data.error_code !== 0) {
      return { success: false, data: null, error: data.reason || '获取车型失败', source: 'JuheCar' };
    }

    // 确保 result 是数组，若不是则视为空数组
    const resultArray = Array.isArray(data.result) ? data.result : [];
    const models = resultArray.map((item: any) => ({
      id: item.id,
      name: item.name, // 根据实际返回调整字段名
    }));

    cache.models.set(seriesId, { data: models, expiresAt: Date.now() + MODELS_TTL });
    return { success: true, data: models as any, source: 'JuheCar' };
  } catch (error: any) {
    console.error('[聚合汽车] 车型列表异常:', error);
    return { success: false, data: null, error: error.message, source: 'JuheCar' };
  }
}