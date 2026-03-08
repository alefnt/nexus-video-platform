// 运行方式: 
// npx tsx tools/test_atlas.ts

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testAtlasCloud() {
    const apiKey = process.env.ATLASCLOUD_API_KEY || process.env.ATLAS_API_KEY;
    if (!apiKey) {
        console.error("❌ 请设置环境变量 ATLASCLOUD_API_KEY");
        process.exit(1);
    }

    const endpoint = "https://api.atlascloud.ai/v1/chat/completions";
    // Fallback to OpenAI o3
    const model = "openai/o3";

    console.log(`🚀 正在连接 Atlas Cloud API (${endpoint})...`);
    console.log(`🤖 模型: ${model}`);

    const payload = {
        model: model,
        messages: [
            { role: "user", content: "Hello!" }
        ],
        stream: true
    };

    console.log("📤 发送 Payload:", JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ 请求失败: ${response.status} ${response.statusText}`);
            console.error(`详细信息: ${errorText}`);
            console.error(`Headers:`, response.headers);
            return;
        }

        const data = await response.json();
        console.log("✅ 响应成功!");
        console.log("----------------------------------------");
        console.log(JSON.stringify(data, null, 2));
        console.log("----------------------------------------");

    } catch (error) {
        console.error("❌ 发生错误:", error);
    }
}

testAtlasCloud();
