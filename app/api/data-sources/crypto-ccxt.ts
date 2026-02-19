import ccxt, { Exchange, Ticker } from 'ccxt';
import { DataSourceResult, UnifiedAsset } from './types';

export async function queryCryptoCCXT(symbol: string): Promise<DataSourceResult> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const baseMarket = `${cleanSymbol}/USDT`;

    console.log(`[Crypto-CCXT] 开始搜索: ${baseMarket}`);

    const exchange: Exchange = new ccxt.binance({
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