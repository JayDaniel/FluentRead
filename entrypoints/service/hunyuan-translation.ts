import { method } from "../utils/constant";
import { config } from "@/entrypoints/utils/config";
import { detectlang } from "../utils/common";

// 混元翻译大模型支持的语言代码映射
const languageMap: Record<string, string> = {
    'zh-Hans': 'zh',    // 简体中文
    'zh-Hant': 'yue',   // 繁体中文使用粤语代码
    'en': 'en',         // 英语
    'ja': 'ja',         // 日语
    'ko': 'ko',         // 韩语
    'fr': 'fr',         // 法语
    'ru': 'ru',         // 俄语
    'de': 'de',         // 德语
    'es': 'es',         // 西班牙语
    'it': 'it',         // 意大利语
    'tr': 'tr',         // 土耳其语
    'ar': 'ar',         // 阿拉伯语
    'pt': 'pt',         // 葡萄牙语
    'th': 'th',         // 泰语
    'vi': 'vi',         // 越南语
    'ms': 'ms',         // 马来语
    'id': 'id',         // 印尼语
    // 注意：auto由代码逻辑特殊处理，不在此映射
};

// 生成HMAC签名 (返回二进制数据)
async function generateHmacSignature(key: string | ArrayBuffer, message: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const keyData = typeof key === 'string' ? encoder.encode(key) : key;

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

// 将二进制数据转换为十六进制字符串
function arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// 生成腾讯云API签名
async function createHunyuanSignature(requestPayload: string, timestamp: number, secretId: string, secretKey: string): Promise<string> {
    const date = new Date(timestamp * 1000).toISOString().substring(0, 10);

    // 步骤1：拼接规范请求串
    const httpRequestMethod = "POST";
    const canonicalUri = "/";
    const canonicalQueryString = "";
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:hunyuan.tencentcloudapi.com\n`;
    const signedHeaders = "content-type;host";

    const hashedRequestPayload = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(requestPayload));
    const hashedPayloadHex = Array.from(new Uint8Array(hashedRequestPayload))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayloadHex}`;

    // 步骤2：拼接待签名字符串
    const algorithm = "TC3-HMAC-SHA256";
    const credentialScope = `${date}/hunyuan/tc3_request`;

    const hashedCanonicalRequest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest));
    const hashedCanonicalRequestHex = Array.from(new Uint8Array(hashedCanonicalRequest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequestHex}`;

    // 步骤3：计算签名
    const kDate = await generateHmacSignature(`TC3${secretKey}`, date);
    const kService = await generateHmacSignature(kDate, "hunyuan");
    const kSigning = await generateHmacSignature(kService, "tc3_request");
    const signatureBuffer = await generateHmacSignature(kSigning, stringToSign);
    const signature = arrayBufferToHex(signatureBuffer);

    // 步骤4：拼接 Authorization
    const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return authorization;
}

async function hunyuanTranslation(message: any) {
    try {
        console.log('🔄 混元翻译开始处理:', message.origin);

        // 从配置中获取 SecretId 和 SecretKey
        const secretId = config.tencentSecretId?.trim();
        const secretKey = config.tencentSecretKey?.trim();

        console.log('🔑 密钥配置状态:', {
            hasSecretId: !!secretId,
            hasSecretKey: !!secretKey,
            service: config.service
        });

        if (!secretId || !secretKey) {
            throw new Error('腾讯混元翻译密钥未配置，请在设置中配置SecretId和SecretKey');
        }

        // 基本格式验证
        if (secretId.length < 10 || secretKey.length < 10) {
            throw new Error('SecretId或SecretKey格式不正确，请检查是否完整复制了密钥信息');
        }

        // 转换语言代码
        // 对于自动检测，使用FluentRead内置的语言检测
        let sourceLang: string;
        if (config.from === 'auto') {
            const detectedLang = detectlang(message.origin.replace(/[\s\u3000]/g, ''));
            sourceLang = languageMap[detectedLang] || detectedLang;
            console.log('🔍 语言检测结果:', { detectedLang, mappedSource: sourceLang });
        } else {
            sourceLang = languageMap[config.from] || config.from;
        }

        const targetLang = languageMap[config.to] || config.to;

        console.log('🌐 语言映射结果:', {
            originalFrom: config.from,
            mappedSource: sourceLang,
            originalTo: config.to,
            mappedTarget: targetLang
        });

        // 如果源语言和目标语言相同，直接返回原文
        if (sourceLang === targetLang) {
            console.log('⚠️ 源语言与目标语言相同，返回原文');
            return message.origin;
        }

        if (!targetLang) {
            throw new Error('混元翻译不支持该目标语言');
        }

        // 获取模型配置，默认使用 hunyuan-translation
        const model = config.model[config.service] || 'hunyuan-translation';

        // 构建请求体
        const requestBody: any = {
            Model: model,
            Stream: false, // 暂时使用非流式调用
            Text: message.origin,
            // Source: sourceLang,
            Target: targetLang
        };

        // 如果有配置领域信息，可以添加 Field 参数
        // requestBody.Field = '通用';

        // 如果需要参考示例，可以添加 References 参数
        // requestBody.References = [{
        //     Type: "sentence",
        //     Text: "示例原文",
        //     Translation: "示例译文"
        // }];

        const requestBodyStr = JSON.stringify(requestBody);
        const timestamp = Math.floor(Date.now() / 1000);

        // 生成签名和Authorization头
        const authorization = await createHunyuanSignature(requestBodyStr, timestamp, secretId, secretKey);

        // 判断是否使用代理
        const url = config.proxy[config.service] || 'https://hunyuan.tencentcloudapi.com/';

        console.log('📤 混元翻译请求:', { url, requestBody, timestamp });

        // 添加超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

        let response: Response;
        try {
            response = await fetch(url, {
                method: method.POST,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Host': 'hunyuan.tencentcloudapi.com',
                    'Authorization': authorization,
                    'X-TC-Action': 'ChatTranslations',
                    'X-TC-Version': '2023-09-01',
                    'X-TC-Region': 'ap-beijing',
                    'X-TC-Timestamp': timestamp.toString()
                },
                body: requestBodyStr,
                signal: controller.signal
            });
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                throw new Error('混元翻译请求超时（30秒），请检查网络连接或稍后重试');
            }
            throw new Error(`混元翻译网络请求失败: ${fetchError.message}`);
        } finally {
            clearTimeout(timeoutId);
        }

        // 处理 HTTP 错误状态
        if (!response.ok) {
            let errorMessage = '';
            try {
                const errorText = await response.text();
                errorMessage = errorText.substring(0, 200); // 限制错误消息长度
            } catch {
                errorMessage = '无法获取错误详情';
            }

            // 特定错误码的友好提示
            switch (response.status) {
                case 400:
                    throw new Error(`混元翻译请求参数错误: ${errorMessage}`);
                case 401:
                case 403:
                    throw new Error('混元翻译鉴权失败，请检查 SecretId 和 SecretKey 是否正确');
                case 429:
                    throw new Error('混元翻译请求过于频繁，请稍后重试');
                case 500:
                    throw new Error('混元翻译服务器内部错误，请稍后重试');
                case 502:
                    throw new Error('混元翻译网关错误（502），腾讯云服务可能暂时不可用，请稍后重试');
                case 503:
                    throw new Error('混元翻译服务暂时不可用（503），请稍后重试');
                case 504:
                    throw new Error('混元翻译网关超时（504），请稍后重试');
                default:
                    throw new Error(`混元翻译请求失败 (${response.status}): ${errorMessage}`);
            }
        }

        let result: any;
        try {
            result = await response.json();
        } catch (parseError) {
            throw new Error('混元翻译返回数据格式错误，无法解析 JSON');
        }

        console.log('📥 混元翻译响应:', result);

        // 检查是否有错误
        if (result.Response?.Error) {
            const errorCode = result.Response.Error.Code;
            const errorMsg = result.Response.Error.Message;
            console.error('❌ 混元翻译API错误:', result.Response.Error);

            // 常见错误码友好提示
            if (errorCode === 'AuthFailure.SecretIdNotFound') {
                throw new Error('SecretId 不存在，请检查配置');
            } else if (errorCode === 'AuthFailure.SignatureFailure') {
                throw new Error('签名验证失败，请检查 SecretKey 是否正确');
            } else if (errorCode === 'LimitExceeded') {
                throw new Error('混元翻译配额已用尽，请检查账户余额');
            } else if (errorCode === 'InvalidParameter') {
                throw new Error(`混元翻译参数错误: ${errorMsg}`);
            }

            throw new Error(`混元翻译错误 [${errorCode}]: ${errorMsg}`);
        }

        // 返回翻译结果
        if (result.Response?.Choices && result.Response.Choices.length > 0) {
            const translatedText = result.Response.Choices[0].Message?.Content;
            if (translatedText) {
                console.log('✅ 混元翻译成功:', translatedText);
                return translatedText;
            }
        }

        console.error('❌ 混元翻译返回格式异常:', result);
        throw new Error('混元翻译返回格式异常，未获取到翻译结果');

    } catch (error: any) {
        console.error('腾讯混元翻译服务调用失败:', error);
        // 确保错误消息对用户友好
        if (error.message) {
            throw error;
        }
        throw new Error('混元翻译服务调用失败，请稍后重试');
    }
}

export default hunyuanTranslation;
