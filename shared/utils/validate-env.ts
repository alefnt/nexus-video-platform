/**
 * 环境变量验证工具
 * FILE: /video-platform/shared/utils/validate-env.ts
 *
 * 在服务启动时检查必需的环境变量是否已配置。
 * 避免服务在运行时因缺少配置而崩溃。
 *
 * 使用示例:
 *   import { validateEnv } from '@video-platform/shared/utils/validate-env';
 *   
 *   validateEnv({
 *     required: ['JWT_SECRET', 'DATABASE_URL'],
 *     optional: ['REDIS_URL', 'SMTP_HOST'],
 *     validators: {
 *       JWT_SECRET: (v) => v.length >= 32 || 'JWT_SECRET 长度必须 >= 32',
 *     },
 *   });
 */

export interface ValidateEnvOptions {
    /** 必须存在且非空的环境变量 */
    required?: string[];
    /** 可选的环境变量（仅在 verbose 模式下打印状态） */
    optional?: string[];
    /** 自定义验证器：返回 true 表示通过，返回 string 表示错误信息 */
    validators?: Record<string, (value: string) => true | string>;
    /** 是否打印配置摘要（默认 false，生产环境建议关闭） */
    verbose?: boolean;
}

export function validateEnv(options: ValidateEnvOptions): void {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必需变量
    if (options.required) {
        for (const key of options.required) {
            const value = process.env[key];
            if (!value || value.trim() === '') {
                errors.push(`❌ ${key} 未配置（必需）`);
            }
        }
    }

    // 运行自定义验证器
    if (options.validators) {
        for (const [key, validator] of Object.entries(options.validators)) {
            const value = process.env[key];
            if (value) {
                const result = validator(value);
                if (result !== true) {
                    errors.push(`❌ ${key}: ${result}`);
                }
            }
        }
    }

    // 检查可选变量
    if (options.optional && options.verbose) {
        for (const key of options.optional) {
            const value = process.env[key];
            if (!value) {
                warnings.push(`⚠️  ${key} 未配置（可选）`);
            }
        }
    }

    // 输出
    if (options.verbose) {
        const allKeys = [
            ...(options.required || []),
            ...(options.optional || []),
        ];
        console.log('📋 环境变量检查:');
        for (const key of allKeys) {
            const value = process.env[key];
            if (value) {
                // 安全打印：不暴露实际值
                const masked = key.toLowerCase().includes('secret') ||
                    key.toLowerCase().includes('password') ||
                    key.toLowerCase().includes('key')
                    ? '****'
                    : value.length > 30
                        ? `${value.substring(0, 15)}...`
                        : value;
                console.log(`  ✅ ${key} = ${masked}`);
            }
        }
    }

    if (warnings.length > 0) {
        for (const w of warnings) {
            console.warn(w);
        }
    }

    if (errors.length > 0) {
        console.error('\n🚨 环境变量验证失败:');
        for (const e of errors) {
            console.error(`  ${e}`);
        }
        console.error('');
        throw new Error(
            `环境变量验证失败: ${errors.length} 个错误。请检查 .env 配置。`
        );
    }
}

/**
 * 常用验证器
 */
export const envValidators = {
    /** 最小长度验证 */
    minLength: (min: number) => (value: string) =>
        value.length >= min || `长度必须 >= ${min}，当前 ${value.length}`,

    /** URL 格式验证 */
    isUrl: (value: string) => {
        try {
            new URL(value);
            return true as const;
        } catch {
            return '不是有效的 URL';
        }
    },

    /** 端口号验证 */
    isPort: (value: string) => {
        const port = parseInt(value, 10);
        return (port > 0 && port <= 65535) || '不是有效的端口号 (1-65535)';
    },
};
