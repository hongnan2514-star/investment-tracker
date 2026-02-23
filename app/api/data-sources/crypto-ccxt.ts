import ccxt, { Exchange, Ticker } from 'ccxt';
import { DataSourceResult, UnifiedAsset } from './types';

export async function queryCryptoCCXT(symbol: string): Promise<DataSourceResult> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const baseMarket = `${cleanSymbol}/USDT`;

    console.log(`[Crypto-CCXT] 开始搜索: ${baseMarket}`);

    const exchange: Exchange = new ccxt.kucoin({
        enableRateLimit: true,
        options: { defaultType: 'spot' }
    });

    try {
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
                return {
                    success: false,
                    data: null,
                    error: `未找到加密货币: ${cleanSymbol}`,
                    source: 'Crypto-CCXT'
                };
            }
        }

        // 类型守卫：确保 ticker 和 marketSymbol 都已赋值
        if (!ticker || !marketSymbol) {
            throw new Error('ticker 或 marketSymbol 未定义，逻辑错误');
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
            source: 'Crypto-CCXT',
            lastUpdated: new Date().toISOString(),
            metadata: {
                high: ticker.high,
                low: ticker.low,
                volume: ticker.baseVolume
            }
        };

        console.log(`[Crypto-CCXT] 成功获取: ${asset.symbol} $${asset.price}`);
        return { success: true, data: asset, source: 'Crypto-CCXT' };

    } catch (error: any) {
        console.error('[Crypto-CCXT] 查询失败:', error.message);
        return {
            success: false,
            data: null,
            error: `CCXT查询失败: ${error.message}`,
            source: 'Crypto-CCXT'
        };
    }
}

/**
 * 获取加密货币历史K线数据（日线）
 * @param symbol 用户输入的代码，如 "BTC"
 * @param days 需要获取的天数，默认365
 */
export async function queryCryptoHistory(symbol: string, days: number = 365): Promise<{ date: string; close: number }[] | null> {
  const cleanSymbol = symbol.toUpperCase().trim();
  const marketSymbol = `${cleanSymbol}/USDT`;

  const exchange: Exchange = new ccxt.binance({
    enableRateLimit: true,
    options: { defaultType: 'spot' }
  });

  try {
    await exchange.loadMarkets();
    if (!exchange.markets?.[marketSymbol]) {
      console.log(`[CCXT] 交易对 ${marketSymbol} 不存在`);
      return null;
    }

    const since = exchange.parse8601(new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
    const ohlcvs = await exchange.fetchOHLCV(marketSymbol, '1d', since, days);
    
    // 过滤掉无效数据，确保每个元素都是有效数组
    const history = ohlcvs
      .filter(ohlcv => ohlcv && ohlcv.length >= 5 && typeof ohlcv[0] === 'number' && typeof ohlcv[4] === 'number')
      .map(ohlcv => ({
        date: new Date(ohlcv[0] as number).toISOString().split('T')[0],
        close: ohlcv[4] as number,
      }));

    return history;
  } catch (error) {
    console.error('[CCXT] 获取历史数据失败:', error);
    return null;
  }
}