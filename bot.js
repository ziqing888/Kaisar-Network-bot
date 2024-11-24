import readline from 'readline';
import fs from 'fs';
import axios from 'axios';
import crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 邀请码（直接硬编码）
const INVITE_CODE = 'LRYXCv620';

// 日志记录
function logger(message, level = 'info') {
    const levels = {
        info: '[信息]',
        success: '[成功]',
        warn: '[警告]',
        error: '[错误]',
    };
    console.log(`${levels[level] || '[日志]'} ${message}`);
}

// 文件操作
function readFromFile(fileName) {
    try {
        return fs.readFileSync(fileName, 'utf-8').split('\n').filter(line => line.trim() !== '');
    } catch (error) {
        logger(`读取文件 ${fileName} 时出错：${error.message}`, 'error');
        return [];
    }
}

function saveToFile(fileName, data) {
    try {
        fs.appendFileSync(fileName, data + '\n');
        logger(`数据已保存到文件：${fileName}`, 'success');
    } catch (error) {
        logger(`保存文件 ${fileName} 时出错：${error.message}`, 'error');
    }
}

// 生成扩展 ID，并根据令牌数量生成对应数量的扩展 ID
function generateExtensionIds(tokens) {
    const extensionIds = tokens.map(() => crypto.randomUUID()); // 根据令牌数量生成扩展 ID
    extensionIds.forEach(extensionId => saveToFile('config/id.txt', extensionId)); // 保存扩展 ID 到 id.txt 文件
    return extensionIds;
}

// 创建 API 客户端，代理支持
function createApiClient(token, proxy) {
    const config = {
        baseURL: 'https://zero-api.kaisar.io/',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    };

    if (proxy) {
        try {
            // 创建 https 代理代理
            config.httpsAgent = new HttpsProxyAgent(proxy);
        } catch (error) {
            logger(`代理配置错误: ${error.message}`, 'error');
        }
    }

    return axios.create(config);
}

// 用户注册
async function registerUser(email, password) {
    try {
        const response = await axios.post(
            'https://zero-api.kaisar.io/auth/register',
            { email, password, inviteCode: INVITE_CODE },
            { headers: { 'Content-Type': 'application/json' } }
        );

        if (response.data) {
            logger(`用户 ${email} 注册成功，请检查邮箱完成验证。`, 'success');
        }
    } catch (error) {
        if (error.response?.data?.error?.code === 410) {
            logger(`用户 ${email} 已注册，尝试登录...`, 'warn');
            await loginUser(email, password);
        } else {
            logger(`注册时出错：${error.message}`, 'error');
        }
    }
}

// 用户登录
async function loginUser(email, password) {
    try {
        const response = await axios.post(
            'https://zero-api.kaisar.io/auth/login',
            { email, password },
            { headers: { 'Content-Type': 'application/json' } }
        );

        if (response.data?.data?.accessToken) {
            const token = response.data.data.accessToken;
            logger(`用户 ${email} 登录成功，令牌已生成。`, 'success');
            saveToFile('config/tokens.txt', token);
        } else {
            logger(`用户 ${email} 登录失败：${response.data.message}`, 'error');
        }
    } catch (error) {
        logger(`登录时出错：${error.message}`, 'error');
    }
}

// 批量注册和登录
async function registerAndLoginUsers(emails, password) {
    for (const email of emails) {
        logger(`正在处理用户 ${email} 的注册和登录...`, 'info');
        await registerUser(email, password);
    }
}

// 获取挖矿数据并显示积分
async function getMiningData(token, extensionId, proxy) {
    const apiClient = createApiClient(token, proxy);

    try {
        const response = await apiClient.get('/mining/current', {
            params: { extension: extensionId },
        });

        // 打印完整的 API 响应数据以调试
        logger(`[${extensionId}] 挖矿数据响应: ${JSON.stringify(response.data)}`, 'info');

        if (response.data?.data) {
            const miningData = response.data.data;

            // 更新挖矿进度
            updateProgress(extensionId, miningData);

            // 更新挖矿积分
            updateMiningPoint(extensionId, miningData);

            // 如果挖矿已结束，执行任务领取
            if (miningData.ended === 1) {
                logger(`[${extensionId}] 挖矿已结束，正在领取挖矿积分...`, 'debug');
                await claim(apiClient, extensionId);
            }
        }
    } catch (error) {
        logger(`[${extensionId}] 获取挖矿数据时出错: ${error.message}`, 'error');
    }
}

// 计算并更新挖矿积分
function updateMiningPoint(extensionId, miningData) {
    const elapsedTimeInHours = (Date.now() - new Date(miningData.start).getTime() - miningData.miss) / 36e5;
    const points = elapsedTimeInHours * miningData.hourly;
    const miningPoint = Math.max(0, points);  // 确保积分不为负数

    logger(`[${extensionId}] 当前挖矿积分: ${miningPoint.toFixed(2)}, 小时收益: ${miningData.hourly} 积分/小时, 已挖矿时间: ${elapsedTimeInHours.toFixed(2)} 小时`, 'warn');
}

// 更新挖矿进度
function updateProgress(extensionId, miningData) {
    const currentTime = Date.now();
    const endTime = miningData.end;

    const remainingTime = Math.max(0, endTime - currentTime);  // 剩余时间（确保不为负数）

    logger(
        `[${extensionId}] 挖矿进度: 剩余时间: ${remainingTime / 1000} 秒`, 'warn'
    );
}

// 领取任务奖励
async function claim(apiClient, extensionId) {
    try {
        logger(`[${extensionId}] 领取挖矿积分...`);
        const { data } = await apiClient.post('/mining/claim', { extension: extensionId });
        logger(`[${extensionId}] 成功领取积分:`, 'success', data);
    } catch (error) {
        logger(`[${extensionId}] 领取积分时出错: ${error.message}`, 'error');
    }
}

// Ping 功能并显示积分
async function pingAndUpdate(token, extensionId, proxy) {
    const apiClient = createApiClient(token, proxy);

    try {
        const response = await apiClient.post('/extension/ping', {
            extension: extensionId,
        });

        if (response.data?.data) {
            logger(`[${extensionId}] Ping 成功:`, 'info');
            await getMiningData(token, extensionId, proxy); // 获取挖矿状态和积分
        } else {
            logger(`[${extensionId}] Ping 未返回有效数据`, 'warn');
        }
    } catch (error) {
        logger(`[${extensionId}] Ping 错误 (代理: ${proxy}): ${error.message}`, 'error');
    }
}

// 每日签到
async function dailyCheckin(token, extensionId, proxy) {
    const apiClient = createApiClient(token, proxy);

    try {
        const response = await apiClient.post('/checkin/check', {});
        if (response.data?.data) {
            logger(`[${extensionId}] 每日签到成功: 签到时间 ${response.data.data.time}`, 'success');
        } else {
            logger(`[${extensionId}] 每日签到未成功: ${response.data?.message || '未知错误'}`, 'warn');
        }
    } catch (error) {
        logger(`[${extensionId}] 每日签到时出错: ${error.message}`, 'error');
    }
}

// 挖矿任务：任务检查与领取
async function checkAndClaimTask(token, extensionId, proxy) {
    const apiClient = createApiClient(token, proxy);

    try {
        const response = await apiClient.get('/mission/tasks');
        const tasks = response.data.data.filter(task => task.status === 1);

        if (tasks.length > 0) {
            logger(`[${extensionId}] 发现 ${tasks.length} 个可领取的任务奖励`, 'success');
            for (const task of tasks) {
                await apiClient.post(`/mission/tasks/${task._id}/claim`);
                logger(`[${extensionId}] 奖励已领取: 任务 ID ${task._id}`, 'success');
            }
        } else {
            logger(`[${extensionId}] 没有找到可领取的任务奖励`, 'info');
        }
    } catch (error) {
        logger(`[${extensionId}] 检查任务时出错: ${error.message}`, 'error');
    }
}

// 动态用户交互
function askUserQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, answer => {
        rl.close();
        resolve(answer.trim());
    }));
}

// 启动挖矿逻辑
async function startMining() {
    const tokens = readFromFile('config/tokens.txt');
    const ids = readFromFile('config/id.txt');
    const proxies = readFromFile('config/proxy.txt');

    if (!tokens.length || !ids.length || !proxies.length) {
        logger("未找到令牌、扩展 ID 或代理配置，无法启动挖矿。", 'error');
        return;
    }

    const lastExecution = {}; // 跟踪每日任务检查和签到

    while (true) {
        const now = Date.now();

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const extensionId = ids[i % ids.length];
            const proxy = proxies[i % proxies.length];

            logger(`[${extensionId}] 开始 Ping，账户 #${i + 1}，使用代理 ${proxy}`);
            await pingAndUpdate(token, extensionId, proxy);

            // 每 24 小时检查任务和签到
            if (!lastExecution[token] || now - lastExecution[token] >= 24 * 60 * 60 * 1000) {
                logger(`[${extensionId}] 开始任务检查和每日签到，账户 #${i + 1}`);
                await checkAndClaimTask(token, extensionId, proxy);
                await dailyCheckin(token, extensionId, proxy);
                lastExecution[token] = now;
            }
        }

        logger(`[${new Date().toISOString()}] 等待 1 分钟后继续...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 60000)); // 每分钟循环一次
    }
}

// 主逻辑：菜单交互
(async () => {
    logger('欢迎使用挖矿自动化工具！', 'info');

    while (true) {
        const userChoice = await askUserQuestion(`
请选择操作：
1. 注册并登录
2. 启动挖矿
3. 生成扩展 ID
4. 退出程序
请输入选项编号（1、2、3 或 4）：
`);

        if (userChoice === '1') {
            const emails = readFromFile('config/emails.txt');
            if (!emails.length) {
                logger('config/emails.txt 文件为空，请添加邮箱后重试。', 'error');
                continue;
            }

            const password = await askUserQuestion('请输入默认注册密码：');
            await registerAndLoginUsers(emails, password || '默认密码123');
        } else if (userChoice === '2') {
            logger('启动挖矿任务...', 'info');
            await startMining();
        } else if (userChoice === '3') {
            const tokens = readFromFile('config/tokens.txt');
            if (tokens.length) {
                logger('生成扩展 ID...', 'info');
                const extensionIds = generateExtensionIds(tokens);  // 生成与令牌数量相同的扩展 ID
                logger(`已生成 ${extensionIds.length} 个扩展 ID。`, 'success');
            } else {
                logger('令牌文件为空，请先注册并登录。', 'error');
            }
        } else if (userChoice === '4') {
            logger('程序退出，感谢使用！', 'info');
            break;
        } else {
            logger('无效的选项，请重新选择。', 'warn');
        }
    }
})();
