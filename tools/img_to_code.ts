// 运行方式:
// 1. set ATLASCLOUD_API_KEY=your_key
// 2. npx tsx tools/img_to_code.ts <path_to_image>

import * as fs from 'fs';
import * as path from 'path';

async function imageToCode(imagePath: string) {
    const apiKey = process.env.ATLASCLOUD_API_KEY || process.env.ATLAS_API_KEY;
    if (!apiKey) {
        console.error("❌ 请设置环境变量 ATLASCLOUD_API_KEY");
        process.exit(1);
    }

    if (!fs.existsSync(imagePath)) {
        console.error(`❌ 找不到图片文件: ${imagePath}`);
        process.exit(1);
    }

    // 读取图片并转换为 Base64
    const bitmap = fs.readFileSync(imagePath);
    const base64Image = Buffer.from(bitmap).toString('base64');
    const ext = path.extname(imagePath).toLowerCase().replace('.', '');
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const endpoint = "https://api.atlascloud.ai/v1/chat/completions";
    // Fallback to OpenAI o3 (GPT-5 APIs are unstable/rate-limited)
    const model = "openai/o3";

    console.log(`🚀 正在发送图片到 OpenAI o3 (${model})...`);
    console.log(`🖼️  图片路径: ${imagePath}`);

    const prompt = `
  这是一个 App 或 网页的 UI 设计图。
  请你扮演一位精通 React, TypeScript 和 TailwindCSS 的高级前端工程师。
  请根据这张图片，生成对应的 React 组件代码。
  
  要求：
  1. 使用 React (TypeScript) + TailwindCSS。
  2. 代码风格现代、整洁。
  3. 使用 Lucide React 图标库（如果需要图标）。
  4. 只需要返回代码，不要包含多余的解释，将代码包裹在 \`\`\`tsx 代码块中。
  5. 确保布局和配色尽可能还原图片。
  `;

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: dataUrl
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 4096
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ 请求失败: ${response.status} ${response.statusText}`);
            console.error(`详细信息: ${errorText}`);
            return;
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        console.log("✅ 代码生成成功!");
        console.log("----------------------------------------");
        console.log(content);
        console.log("----------------------------------------");

        // 简单提取代码块保存
        const match = content.match(/```tsx([\s\S]*?)```/);
        if (match) {
            const code = match[1].trim();
            const outPath = path.resolve(process.cwd(), "generated_ui.tsx");
            fs.writeFileSync(outPath, code);
            console.log(`💾 代码已保存至: ${outPath}`);
        }

    } catch (error) {
        console.error("❌ 发生错误:", error);
    }
}

const args = process.argv.slice(2);
if (args.length < 1) {
    console.log("Usage: npx tsx tools/img_to_code.ts <image_path>");
} else {
    imageToCode(args[0]);
}
