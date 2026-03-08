// FILE: /video-platform/tests/load/k6-load-test.js
/**
 * k6 负载测试脚本
 * 
 * 运行方式:
 *   k6 run tests/load/k6-load-test.js
 *   k6 run --vus 100 --duration 5m tests/load/k6-load-test.js
 * 
 * 环境变量:
 *   BASE_URL - API 基础地址 (默认: http://localhost:8080)
 *   JWT_TOKEN - 测试用 JWT Token
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ============== 自定义指标 ==============
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const successfulRequests = new Counter('successful_requests');

// ============== 配置 ==============
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

const headers = {
    'Content-Type': 'application/json',
    'Authorization': JWT_TOKEN ? `Bearer ${JWT_TOKEN}` : '',
};

// ============== 测试场景配置 ==============
export const options = {
    scenarios: {
        // 场景1: 冒烟测试 (验证基本功能)
        smoke: {
            executor: 'constant-vus',
            vus: 1,
            duration: '30s',
            startTime: '0s',
            tags: { scenario: 'smoke' },
        },

        // 场景2: 负载测试 (正常负载)
        load: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 50 },   // 1分钟内增加到50用户
                { duration: '3m', target: 50 },   // 保持50用户3分钟
                { duration: '1m', target: 100 },  // 增加到100用户
                { duration: '3m', target: 100 },  // 保持100用户3分钟
                { duration: '1m', target: 0 },    // 逐步减少到0
            ],
            startTime: '30s',
            tags: { scenario: 'load' },
        },

        // 场景3: 压力测试 (超出正常负载)
        stress: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 200 },
                { duration: '5m', target: 200 },
                { duration: '2m', target: 300 },
                { duration: '5m', target: 300 },
                { duration: '2m', target: 0 },
            ],
            startTime: '10m',
            tags: { scenario: 'stress' },
        },

        // 场景4: 峰值测试 (突发流量)
        spike: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 500 }, // 快速增加到500
                { duration: '1m', target: 500 },  // 保持
                { duration: '10s', target: 0 },   // 快速降到0
            ],
            startTime: '25m',
            tags: { scenario: 'spike' },
        },
    },

    thresholds: {
        http_req_duration: ['p(95)<3000'],    // 95% 请求 < 3秒
        http_req_failed: ['rate<0.05'],        // 失败率 < 5%
        errors: ['rate<0.1'],                  // 错误率 < 10%
        api_latency: ['p(99)<5000'],           // 99% 延迟 < 5秒
    },
};

// ============== 测试函数 ==============

export default function () {
    // 随机选择测试场景
    const scenarios = [
        testHealthCheck,
        testVideoList,
        testSearch,
        testRecommendations,
        testTrending,
    ];

    // 如果有 Token，添加需要认证的测试
    if (JWT_TOKEN) {
        scenarios.push(testUserProfile, testLikeVideo);
    }

    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    scenario();

    sleep(Math.random() * 2 + 0.5); // 0.5-2.5秒随机间隔
}

// ============== 测试用例 ==============

function testHealthCheck() {
    group('Health Check', () => {
        const services = [
            { name: 'identity', port: 8080 },
            { name: 'payment', port: 8091 },
            { name: 'content', port: 8092 },
            { name: 'metadata', port: 8093 },
            { name: 'search', port: 8101 },
        ];

        for (const service of services) {
            const url = `http://localhost:${service.port}/health`;
            const res = http.get(url, { timeout: '5s' });

            const success = check(res, {
                [`${service.name} is healthy`]: (r) => r.status === 200,
                [`${service.name} response time < 500ms`]: (r) => r.timings.duration < 500,
            });

            errorRate.add(!success);
            if (success) successfulRequests.add(1);
        }
    });
}

function testVideoList() {
    group('Video List', () => {
        const res = http.get(`${BASE_URL}/metadata/list`, { headers });
        const start = Date.now();

        const success = check(res, {
            'video list status 200': (r) => r.status === 200,
            'video list is array': (r) => Array.isArray(JSON.parse(r.body || '[]')),
            'video list response time < 1s': (r) => r.timings.duration < 1000,
        });

        apiLatency.add(Date.now() - start);
        errorRate.add(!success);
        if (success) successfulRequests.add(1);
    });
}

function testSearch() {
    group('Search', () => {
        const queries = ['video', 'live', 'music', 'gaming', 'tutorial'];
        const query = queries[Math.floor(Math.random() * queries.length)];

        const res = http.get(`http://localhost:8101/search?q=${query}&type=video`, { headers });

        const success = check(res, {
            'search status 200': (r) => r.status === 200,
            'search has results': (r) => {
                try {
                    const body = JSON.parse(r.body || '{}');
                    return body.results !== undefined || body.hits !== undefined;
                } catch {
                    return false;
                }
            },
            'search response time < 500ms': (r) => r.timings.duration < 500,
        });

        apiLatency.add(res.timings.duration);
        errorRate.add(!success);
        if (success) successfulRequests.add(1);
    });
}

function testRecommendations() {
    group('Recommendations', () => {
        const res = http.get(`http://localhost:8101/recommendations?limit=20`, { headers });

        const success = check(res, {
            'recommendations status 200': (r) => r.status === 200,
            'recommendations has data': (r) => {
                try {
                    const body = JSON.parse(r.body || '{}');
                    return body.recommendations !== undefined;
                } catch {
                    return false;
                }
            },
            'recommendations response time < 1s': (r) => r.timings.duration < 1000,
        });

        apiLatency.add(res.timings.duration);
        errorRate.add(!success);
        if (success) successfulRequests.add(1);
    });
}

function testTrending() {
    group('Trending', () => {
        const types = ['video', 'live'];
        const type = types[Math.floor(Math.random() * types.length)];

        const res = http.get(`http://localhost:8101/trending?type=${type}`, { headers });

        const success = check(res, {
            'trending status 200': (r) => r.status === 200,
            'trending has data': (r) => {
                try {
                    const body = JSON.parse(r.body || '{}');
                    return body.trending !== undefined;
                } catch {
                    return false;
                }
            },
        });

        apiLatency.add(res.timings.duration);
        errorRate.add(!success);
        if (success) successfulRequests.add(1);
    });
}

function testUserProfile() {
    group('User Profile', () => {
        const res = http.get(`${BASE_URL}/auth/me`, { headers });

        const success = check(res, {
            'profile status 200 or 401': (r) => r.status === 200 || r.status === 401,
        });

        errorRate.add(!success);
        if (success) successfulRequests.add(1);
    });
}

function testLikeVideo() {
    group('Like Video', () => {
        const videoId = `video-${Math.floor(Math.random() * 100)}`;

        const res = http.post(
            `http://localhost:8093/metadata/like`,
            JSON.stringify({ videoId }),
            { headers }
        );

        const success = check(res, {
            'like status 200 or 401': (r) => r.status === 200 || r.status === 401,
        });

        errorRate.add(!success);
        if (success) successfulRequests.add(1);
    });
}

// ============== 测试结束回调 ==============
export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'tests/load/results/summary.json': JSON.stringify(data, null, 2),
    };
}

function textSummary(data, options = {}) {
    const indent = options.indent || '';

    let summary = `
${indent}========== 负载测试结果 ==========
${indent}
${indent}总请求数: ${data.metrics.http_reqs?.values?.count || 0}
${indent}成功请求: ${data.metrics.successful_requests?.values?.count || 0}
${indent}失败率: ${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%
${indent}
${indent}响应时间 (P95): ${(data.metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms
${indent}响应时间 (P99): ${(data.metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms
${indent}平均响应时间: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms
${indent}
${indent}阈值检查:
`;

    for (const [name, threshold] of Object.entries(data.metrics)) {
        if (threshold.thresholds) {
            for (const [check, passed] of Object.entries(threshold.thresholds)) {
                const status = passed.ok ? '✅' : '❌';
                summary += `${indent}  ${status} ${name}: ${check}\n`;
            }
        }
    }

    return summary;
}
