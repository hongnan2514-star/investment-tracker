// app/api/data-sources/crypto-ccxt.ts
import ccxt, { Exchange, Ticker } from 'ccxt';
import { DataSourceResult, UnifiedAsset } from './types';

/**
 * CoinGecko 后备数据源（无需认证）
 */
async function fetchFromCoinGecko(symbol: string): Promise<DataSourceResult> {
  try {
    const upperSymbol = symbol.toUpperCase();
    // CoinGecko 的币种 ID 映射（常见币种）
    const coinIdMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'DOGE': 'dogecoin',
      'DOT': 'polkadot',
      'MATIC': 'polygon',
      'SHIB': 'shiba-inu',
      'AVAX': 'avalanche-2',
      'UNI': 'uniswap',
      'LINK': 'chainlink',
      'ATOM': 'cosmos',
      'ETC': 'ethereum-classic',
      'XLM': 'stellar',
      'BCH': 'bitcoin-cash',
      'ALGO': 'algorand',
      'VET': 'vechain',
      'FIL': 'filecoin',
      'TRX': 'tron',
      'FTM': 'fantom',
      'NEAR': 'near',
      'ICP': 'internet-computer',
      'APT': 'aptos',
      'LDO': 'lido-dao',
      'QNT': 'quant-network',
      'SAND': 'the-sandbox',
      'MANA': 'decentraland',
      'AXS': 'axie-infinity',
      'EGLD': 'elrond',
      'THETA': 'theta-token',
      'STX': 'stacks',
      'EOS': 'eos',
      'AAVE': 'aave',
      'CAKE': 'pancakeswap-token',
    };
    const coinId = coinIdMap[upperSymbol] || upperSymbol.toLowerCase();
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) }); // 10秒超时
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const priceData = data[coinId];
    if (!priceData || priceData.usd === undefined) throw new Error('无价格数据');

    const asset: UnifiedAsset = {
      symbol: `${upperSymbol}/USDT`,
      name: upperSymbol,
      price: priceData.usd,
      changePercent: priceData.usd_24h_change || 0,
      currency: 'USD',
      market: 'Crypto',
      type: 'crypto',
      source: 'CoinGecko',
      lastUpdated: new Date().toISOString(),
      metadata: {}
    };
    return { success: true, data: asset, source: 'CoinGecko' };
  } catch (error) {
    console.error('[CoinGecko] 获取失败:', error);
    return { success: false, data: null, error: 'CoinGecko 后备失败', source: 'CoinGecko' };
  }
}

/**
 * 查询单个加密货币的实时行情（支持多交易所重试 + CoinGecko 后备）
 */
export async function queryCryptoCCXT(symbol: string): Promise<DataSourceResult> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const baseMarket = `${cleanSymbol}/USDT`;

    console.log(`[Crypto-CCXT] 开始搜索: ${baseMarket}`);

    // 按偏好顺序排列的交易所列表（越靠前越优先）
    const exchangesToTry = ['binance', 'kucoin', 'gateio', 'okx', 'coinbase'];
    let lastError: any = null;

    for (const exchangeId of exchangesToTry) {
        try {
            console.log(`[Crypto-CCXT] 尝试交易所: ${exchangeId}`);
            const exchange: Exchange = new (ccxt as any)[exchangeId]({
                enableRateLimit: true,
                timeout: 30000, // 30秒超时
                options: { defaultType: 'spot' }
            });

            await exchange.loadMarkets();

            let marketSymbol: string | undefined;
            let ticker: Ticker | undefined;

            // 检查默认交易对是否存在
            if (exchange.markets?.[baseMarket]) {
                ticker = await exchange.fetchTicker(baseMarket);
                marketSymbol = baseMarket;
            } else {
                // 尝试备选交易对
                const alternatives = [
                    `${cleanSymbol}/USDC`,
                    `${cleanSymbol}/BTC`,
                    `${cleanSymbol}/ETH`
                ];
                let found = false;
                for (const alt of alternatives) {
                    if (exchange.markets?.[alt]) {
                        console.log(`[Crypto-CCXT] 尝试备选交易对: ${alt}`);
                        ticker = await exchange.fetchTicker(alt);
                        marketSymbol = alt;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    console.log(`[Crypto-CCXT] 交易对 ${baseMarket} 在 ${exchangeId} 上不存在，尝试下一个交易所`);
                    continue;
                }
            }

            if (!ticker || !marketSymbol) {
                console.log(`[Crypto-CCXT] ticker 或 marketSymbol 未定义，尝试下一个交易所`);
                continue;
            }

            const quoteCurrency = marketSymbol.split('/')[1] || 'USDT';

            const asset: UnifiedAsset = {
                symbol: marketSymbol,
                name: cleanSymbol,
                price: ticker.last ?? 0,
                changePercent: ticker.percentage ?? 0,
                currency: quoteCurrency,
                market: 'Crypto',
                type: 'crypto',
                source: `Crypto-CCXT (${exchangeId})`,
                lastUpdated: new Date().toISOString(),
                metadata: {
                    high: ticker.high,
                    low: ticker.low,
                    volume: ticker.baseVolume
                }
            };

            console.log(`[Crypto-CCXT] 从 ${exchangeId} 成功获取: ${asset.symbol} $${asset.price}`);
            return { success: true, data: asset, source: `Crypto-CCXT (${exchangeId})` };

        } catch (error: any) {
            console.error(`[Crypto-CCXT] 从 ${exchangeId} 查询失败:`, error.message);
            lastError = error;
            // 继续尝试下一个交易所
        }
    }

    // 所有交易所均失败，尝试 CoinGecko 后备
    console.warn('[Crypto-CCXT] 所有交易所均失败，尝试 CoinGecko 后备');
    const geckoResult = await fetchFromCoinGecko(cleanSymbol);
    if (geckoResult.success) {
        return geckoResult;
    }

    console.error('[Crypto-CCXT] 所有数据源均失败:', lastError);
    return {
        success: false,
        data: null,
        error: `未找到加密货币: ${cleanSymbol}`,
        source: 'Crypto-CCXT'
    };
}

/**
 * 获取加密货币历史K线数据（日线）
 * @param symbol 用户输入的代码，如 "BTC"
 * @param days 需要获取的天数，默认365
 */
export async function queryCryptoHistory(symbol: string, days: number = 365): Promise<{ date: string; close: number }[] | null> {
  const cleanSymbol = symbol.toUpperCase().trim();
  const marketSymbol = `${cleanSymbol}/USDT`;

  const exchangesToTry = ['binance', 'kucoin', 'gateio', 'okx', 'coinbase'];
  let lastError: any = null;

  for (const exchangeId of exchangesToTry) {
    try {
      console.log(`[CCXT] 尝试交易所: ${exchangeId} 获取日线数据 for ${marketSymbol}`);
      const exchange: Exchange = new (ccxt as any)[exchangeId]({
        enableRateLimit: true,
        timeout: 20000,
        options: { defaultType: 'spot' }
      });

      await exchange.loadMarkets();
      if (!exchange.markets?.[marketSymbol]) {
        console.log(`[CCXT] 交易对 ${marketSymbol} 在 ${exchangeId} 上不存在，尝试下一个`);
        continue;
      }

      const since = exchange.parse8601(new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
      const ohlcvs = await exchange.fetchOHLCV(marketSymbol, '1d', since, days);

      const history = ohlcvs
        .filter(ohlcv => ohlcv && ohlcv.length >= 5 && typeof ohlcv[0] === 'number' && typeof ohlcv[4] === 'number')
        .map(ohlcv => ({
          date: new Date(ohlcv[0] as number).toISOString().split('T')[0],
          close: ohlcv[4] as number,
        }));

      console.log(`[CCXT] 从 ${exchangeId} 成功获取 ${history.length} 条日线数据`);
      return history;
    } catch (error: any) {
      console.error(`[CCXT] 从 ${exchangeId} 获取日线数据失败:`, error.message);
      lastError = error;
    }
  }

  console.error('[CCXT] 所有交易所获取日线数据均失败:', lastError);
  return null;
}

// ========== 新增：分钟级 OHLCV 完整数据获取 ==========

// 共享的分钟数据交易所列表（按偏好顺序，可根据需要调整）
const MINUTE_DATA_EXCHANGES = ['kucoin', 'gateio', 'okx', 'coinbase'];

/**
 * 获取加密货币分钟级 OHLCV 完整数据（支持增量拉取）
 * @param symbol 基础币种，如 "BTC"
 * @param timeframe 时间粒度，如 '15m', '1h', '6h'
 * @param limit 当 since 未提供时，拉取的最大条数（默认288）
 * @param sinceTimestamp 可选，起始时间戳（毫秒），只拉取此时间之后的数据
 */
export async function fetchCryptoMinuteData(
  symbol: string,
  timeframe: string = '5m',
  limit: number = 288,
  sinceTimestamp?: number
): Promise<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] | null> {
  const cleanSymbol = symbol.toUpperCase().trim();
  const marketSymbol = `${cleanSymbol}/USDT`;

  const MINUTE_DATA_EXCHANGES = ['kucoin', 'gateio', 'okx', 'coinbase']; // 按偏好顺序
  let lastError: any = null;

  for (const exchangeId of MINUTE_DATA_EXCHANGES) {
    try {
      console.log(`[CCXT] 尝试交易所: ${exchangeId} 获取分钟数据 for ${marketSymbol} ${timeframe}`);
      console.log(`[CCXT] sinceTimestamp = ${sinceTimestamp} (${sinceTimestamp ? new Date(sinceTimestamp).toISOString() : 'undefined'})`);

      const exchange: Exchange = new (ccxt as any)[exchangeId]({
        enableRateLimit: true,
        timeout: 20000,
        options: { defaultType: 'spot' }
      });

      await exchange.loadMarkets();
      if (!exchange.markets?.[marketSymbol]) {
        console.log(`[CCXT] 交易对 ${marketSymbol} 在 ${exchangeId} 上不存在，尝试下一个`);
        continue;
      }

      // 处理 sinceTimestamp：某些交易所可能不支持太早的时间，这里限制为最多6个月前
      let since = sinceTimestamp;
      if (since) {
        const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000; // 6个月
        if (since < sixMonthsAgo) {
          console.log(`[CCXT] sinceTimestamp 太早 (${new Date(since).toISOString()})，调整为6个月前`);
          since = sixMonthsAgo;
        }
      }

      if (!since) {
        // 如果没有提供 since，则根据 limit 和当前时间计算
        since = exchange.parse8601(
          new Date(Date.now() - limit * exchange.parseTimeframe(timeframe) * 1000).toISOString()
        );
      }

      console.log(`[CCXT] 最终 since = ${since} (${new Date(since).toISOString()})`);

      const ohlcvs = await exchange.fetchOHLCV(marketSymbol, timeframe, since, limit);

      console.log(`[CCXT] 收到 ${ohlcvs.length} 条原始数据`);

      // 过滤有效数据
      const validOHLCVs = ohlcvs.filter(
        (ohlcv): ohlcv is [number, number, number, number, number, number] =>
          ohlcv && ohlcv.length >= 6 && 
          typeof ohlcv[0] === 'number' &&
          typeof ohlcv[1] === 'number' &&
          typeof ohlcv[2] === 'number' &&
          typeof ohlcv[3] === 'number' &&
          typeof ohlcv[4] === 'number' &&
          typeof ohlcv[5] === 'number'
      );

      console.log(`[CCXT] 有效数据 ${validOHLCVs.length} 条`);

      if (validOHLCVs.length > 0) {
        const firstTs = validOHLCVs[0][0];
        const lastTs = validOHLCVs[validOHLCVs.length-1][0];
        console.log(`[CCXT] 数据范围: ${new Date(firstTs).toISOString()} 至 ${new Date(lastTs).toISOString()}`);
      }

      // 如果数据为空，尝试下一个交易所
      if (validOHLCVs.length === 0) {
        console.log(`[CCXT] ${exchangeId} 返回0条数据，尝试下一个交易所`);
        continue;
      }

      return validOHLCVs.map(ohlcv => ({
        timestamp: Math.floor(ohlcv[0] / 1000),
        open: ohlcv[1],
        high: ohlcv[2],
        low: ohlcv[3],
        close: ohlcv[4],
        volume: ohlcv[5],
      }));
    } catch (error: any) {
      console.error(`[CCXT] 从 ${exchangeId} 获取分钟数据失败:`, error.message, error.stack);
      lastError = error;
      // 继续尝试下一个交易所
    }
  }

  console.error('[CCXT] 所有交易所获取分钟数据均失败:', lastError);
  return null;
}

/**
 * 获取加密货币 OHLCV 数据（简化版，仅返回 timestamp 和 close）
 * 保留此函数以兼容旧代码，内部直接调用 fetchCryptoMinuteData
 */
export async function queryCryptoOHLCV(
  symbol: string,
  timeframe: string = '5m',
  limit: number = 288
): Promise<{ timestamp: number; close: number }[] | null> {
  const fullData = await fetchCryptoMinuteData(symbol, timeframe, limit);
  if (!fullData) return null;
  return fullData.map(item => ({ timestamp: item.timestamp, close: item.close }));
}

/**
 * 获取加密货币日线 OHLCV 数据，支持从指定时间戳开始
 * @param symbol 基础币种，如 "BTC"
 * @param sinceTimestamp 可选，起始时间戳（毫秒），不传则拉取最近365天
 */
export async function fetchCryptoDailyHistory(
  symbol: string,
  sinceTimestamp?: number
): Promise<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] | null> {
  const cleanSymbol = symbol.toUpperCase().trim();
  const marketSymbol = `${cleanSymbol}/USDT`;

  const exchangesToTry = ['binance', 'kucoin', 'gateio', 'okx', 'coinbase'];
  for (const exchangeId of exchangesToTry) {
    try {
      console.log(`[CCXT] 尝试交易所: ${exchangeId} 获取日线数据 for ${marketSymbol}`);
      console.log(`[CCXT] sinceTimestamp = ${sinceTimestamp} (${sinceTimestamp ? new Date(sinceTimestamp).toISOString() : 'undefined'})`);

      const exchange: Exchange = new (ccxt as any)[exchangeId]({
        enableRateLimit: true,
        timeout: 20000,
        options: { defaultType: 'spot' }
      });

      await exchange.loadMarkets();
      if (!exchange.markets?.[marketSymbol]) {
        console.log(`[CCXT] 交易对 ${marketSymbol} 在 ${exchangeId} 上不存在，尝试下一个`);
        continue;
      }

      const ohlcvs = await exchange.fetchOHLCV(
        marketSymbol,
        '1d',
        sinceTimestamp, // 毫秒时间戳
        sinceTimestamp ? undefined : 365 // 有 since 时不限制条数
      );

      console.log(`[CCXT] 收到 ${ohlcvs.length} 条 OHLCV 原始数据`);

      // 第一步：过滤出有效的 OHLCV（确保包含6个数字）
      const validOHLCVs = ohlcvs.filter(
        (ohlcv): ohlcv is [number, number, number, number, number, number] =>
          ohlcv && 
          ohlcv.length >= 6 && 
          typeof ohlcv[0] === 'number' &&
          typeof ohlcv[1] === 'number' &&
          typeof ohlcv[2] === 'number' &&
          typeof ohlcv[3] === 'number' &&
          typeof ohlcv[4] === 'number' &&
          typeof ohlcv[5] === 'number'
      );

      console.log(`[CCXT] 有效 OHLCV 条数: ${validOHLCVs.length}`);

      // 第二步：根据 sinceTimestamp 手动过滤（如果有）
      let filtered = validOHLCVs;
      if (sinceTimestamp) {
        filtered = validOHLCVs.filter(ohlcv => ohlcv[0] >= sinceTimestamp);
        console.log(`[CCXT] 手动过滤后得到 ${filtered.length} 条数据`);
      }

      // 记录数据范围（仅当有数据时）
      if (filtered.length > 0) {
        const firstTs = filtered[0][0];
        const lastTs = filtered[filtered.length-1][0];
        console.log(`[CCXT] 过滤后数据范围: ${new Date(firstTs).toISOString()} 至 ${new Date(lastTs).toISOString()}`);
      }

      console.log(`[CCXT] 从 ${exchangeId} 成功获取 ${filtered.length} 条有效日线数据`);
      return filtered.map(ohlcv => ({
        timestamp: Math.floor(ohlcv[0] / 1000),
        open: ohlcv[1],
        high: ohlcv[2],
        low: ohlcv[3],
        close: ohlcv[4],
        volume: ohlcv[5],
      }));
    } catch (error: any) {
      console.error(`[CCXT] 从 ${exchangeId} 获取日线数据失败:`, error.message);
    }
  }
  return null;
}