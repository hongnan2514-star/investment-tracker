import { DataSourceResult, UnifiedAsset } from "./types";
import crypto from 'crypto';

interface GovConfig {
    clientId: string;
    secret: string;
    baseUrl: string;
}

const config: GovConfig = {
    clientId: process.env.GOV_CLIENT_ID || '',
    secret: process.env.GOV_CLIENT_SECRET || '',
    baseUrl: 'https://www.chengdu.gov.cn/data/gateway/api/1/sfgj/gjxmmccxy/xsxmxx'
};

/**
 * 生成签名
 * 规则：X-Client-Id + X-Timestamp + X-Nonce 组合，HmacSHA256加密
 */
function generateSignature(clientId: string, timestamp: string, nonce: string, secret: string): string {
    const signStr = clientId + timestamp + nonce;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signStr);
    return hmac.digest('base64');
}

/**
 * 根据项目名称查询房产信息
 * @param projectName 项目名称，如"学府家苑"
 */
export async function searchGovRealEstate(projectName: string): Promise<DataSourceResult> {
    console.log(`[政府数据] 开始搜索房产项目: ${projectName}`);

    try {
        // 1. 生成请求头参数
        const timestamp = Date.now().toString();
        const nonce = Math.random().toString(36).substring(2, 15);
        const signature = generateSignature(
            config.clientId,
            timestamp,
            nonce,
            config.secret
        );

        // 2. 构建请求
        const url = new URL(config.baseUrl);
        url.searchParams.append('PROJECT', projectName); // 参数名需大写

        console.log(`[政府数据] 请求URL: ${url.toString()}`);
        console.log(`[政府数据] 请求头:`, { 'X-Client-Id': config.clientId, 'X-Timestamp': timestamp, 'X-Nonce': nonce });

        const response = await fetch(url.toString(), {
            headers: {
                'X-Client-Id': config.clientId,
                'X-Timestamp': timestamp,
                'X-Nonce': nonce,
                'X-Signature': signature
            }
        });

        console.log(`[政府数据] 响应状态: ${response.status}`);
        const responseText = await response.text(); // 先获取文本
        console.log(`[政府数据] 响应原文: ${responseText.substring(0, 500)}`); // 打印前500字符

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // 解析 JSON
        const data = JSON.parse(responseText);
        
        // 3. 解析返回数据（根据实际返回结构调整）
        // 假设返回格式为 { code: 200, data: [...] }
        if (data.code !== 200 || !data.data || data.data.length === 0) {
            return {
                success: false,
                data: null,
                error: `未找到项目"${projectName}"的相关信息`,
                source: 'GovRealEstate'
            };
        }

        const projectList = data.data;
        
        // 4. 计算均价（如果有面积字段，按面积加权平均）
        let totalPrice = 0;
        let totalArea = 0;
        let validCount = 0;

        for (const item of projectList) {
            // 注意：接口返回的是预/现售面积，不是价格
            // 这里需要根据实际情况调整，可能需要从其他字段获取价格信息
            const area = parseFloat(item.AREA) || 0;
            if (area > 0) {
                totalArea += area;
                validCount++;
            }
        }

        const avgPrice = validCount > 0 ? Math.round(totalPrice / validCount) : 0;

        // 5. 构造资产对象
        const asset: UnifiedAsset = {
            symbol: `CN-CD-${projectName}`,
            name: projectName,
            price: avgPrice,
            changePercent: 0,
            currency: 'CNY',
            market: '中国房产市场',
            type: 'real_estate',
            source: 'GovRealEstate',
            lastUpdated: new Date().toISOString(),
            metadata: {
                city: '成都',
                projectCount: projectList.length,
                sampleProjects: projectList.slice(0, 3).map((p: any) => ({
                    name: p.PROJECT,
                    area: p.AREA,
                    address: p.ADDRESS,
                    developer: p.UNITNAME,
                    saleDate: p.OPENSALEDATE
                })),
                regionCodes: [...new Set(projectList.map((p: any) => p.REGIONCODE))],
                rawData: data
            }
        };

        console.log(`[政府数据] 成功获取项目信息: ${projectList.length}个记录`);
        return { success: true, data: asset, source: 'GovRealEstate' };

    } catch (error: any) {
        console.error('[政府数据] 查询失败:', error);
        return {
            success: false,
            data: null,
            error: `房产查询失败: ${error.message}`,
            source: 'GovRealEstate'
        };
    }
}