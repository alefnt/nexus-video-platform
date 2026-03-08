// 运行方式: 
// npx tsx tools/list_models.ts

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listModels() {
    const apiKey = process.env.ATLASCLOUD_API_KEY || process.env.ATLAS_API_KEY;
    if (!apiKey) {
        console.error("❌ 请设置环境变量 ATLASCLOUD_API_KEY");
        process.exit(1);
    }

    const endpoint = "https://api.atlascloud.ai/v1/models";

    console.log(`🚀 正在查询可用模型列表 (${endpoint})...`);

    try {
        const response = await fetch(endpoint, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ 请求失败: ${response.status} ${response.statusText}`);
            console.error(`详细信息: ${errorText}`);
            return;
        }

        const data = await response.json();
        console.log("✅ 响应成功!");
        console.log("----------------------------------------");
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach((m: any) => {
                console.log(`- ${m.id}`);
            });
        } else {
            console.log("未找到模型列表或格式不同:", data);
        }
        console.log("----------------------------------------");

    } catch (error) {
        console.error("❌ 发生错误:", error);
    }
}

listModels();
