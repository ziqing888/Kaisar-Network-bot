import readline from 'readline';
import fs from 'fs';
import axios from 'axios';
import crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';
import chalk from 'chalk';

const author = '@qklxsqf';
const channel = 'https://t.me/ksqxszq';

const banner = `
${chalk.yellow('╔════════════════════════════════════════╗')}
${chalk.yellow('║')}      🚀 ${chalk.green('Kaisar-Network-bot')} 🚀          ${chalk.yellow('║')}
${chalk.yellow('║')}  👤  脚本编写：${chalk.blue(author)}                ${chalk.yellow('║')}
${chalk.yellow('║')}  📢  电报频道：${chalk.cyan(channel)}    ${chalk.yellow('║')}
${chalk.yellow('╚════════════════════════════════════════╝')}
`;

// 日志记录
function logger(message, level = 'info') {
    const levels = {
        info: chalk.blue('[信息]'),
        success: chalk.green('[成功]'),
        warn: chalk.yellow('[警告]'),
        error: chalk.red('[错误]'),
    };

    const timestamp = chalk.gray(`[${new Date().toISOString()}]`);
    const prefix = levels[level] || chalk.white('[日志]');

    console.log(`${timestamp} ${prefix} ${message}`);
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

// 生成扩展 ID
function generateExtensionIds(tokens) {
    const extensionIds = tokens.map(() => crypto.randomUUID());
    extensionIds.forEach(extensionId => saveToFile('config/id.txt', extensionId));
    logger(`生成的扩展 ID 数量：${extensionIds.length}`, 'success');
    return extensionIds;
}

// 创建 API 客户端
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
            config.httpsAgent = new HttpsProxyAgent(proxy);
        } catch (error) {
            logger(`代理配置错误: ${error.message}`, 'error');
        }
    }

    return axios.create(config);
}

// 注册用户
async function registerUser(email, password) {
    try {
        const response = await axios.post(
            'https://zero-api.kaisar.io/auth/register',
            { email, password, inviteCode: 'LRYXCv620' },
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

// 登录用户
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

// 每日签到
async function dailyCheckin(apiClient, extensionId) {
    try {
        const response = await apiClient.post('/checkin/check', {});
        if (response.data?.data) {
            logger(`[${extensionId}] 每日签到成功: 签到时间 ${response.data.data.time}`, 'success');
        } else {
            logger(`[${extensionId}] 每日签到未成功: ${response.data?.message || '未知错误'}`, 'warn');
        }
    } catch (error) {
        if (error.response?.status === 412) {
            logger(`[${extensionId}] 每日签到已完成，无需重复签到。`, 'info');
        } else {
            logger(`[${extensionId}] 每日签到时出错: ${error.message}`, 'error');
        }
    }
}

// 检查并领取任务奖励
async function checkAndClaimTask(apiClient, extensionId) {
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

// 获取挖矿数据
async function getMiningData(apiClient, extensionId) {
    try {
        const response = await apiClient.get('/mining/current', {
            params: { extension: extensionId },
        });

        if (response.data?.data) {
            const miningData = response.data.data;

            updateProgress(extensionId, miningData);
            updateMiningPoint(extensionId, miningData);

            if (miningData.ended === 1) {
                logger(`[${extensionId}] 挖矿任务已结束，尝试领取积分并启动新的挖矿任务...`, 'info');
                await claim(apiClient, extensionId);
            }
        }
    } catch (error) {
        logger(`[${extensionId}] 获取挖矿数据时出错: ${error.message}`, 'error');
    }
}

// 更新挖矿积分
function updateMiningPoint(extensionId, miningData) {
    const elapsedTimeInHours = (Date.now() - new Date(miningData.start).getTime() - miningData.miss) / 36e5;
    const points = elapsedTimeInHours * miningData.hourly;
    const miningPoint = Math.max(0, points);

    logger(
        `[${extensionId}] 当前挖矿积分: ${miningPoint.toFixed(2)}, 每小时收益: ${miningData.hourly}, 挖矿时间: ${elapsedTimeInHours.toFixed(2)} 小时`,
        'warn'
    );
}

// 更新挖矿进度
function updateProgress(extensionId, miningData) {
    const remainingTime = Math.max(0, miningData.end - Date.now());
    logger(`[${extensionId}] 挖矿进度: 剩余时间: ${(remainingTime / 1000).toFixed(2)} 秒`, 'warn');
}

// 领取积分并启动新任务
async function claim(apiClient, extensionId) {
    try {
        logger(`[${extensionId}] 尝试领取挖矿积分...`);
        const response = await apiClient.post('/mining/claim', { extension: extensionId });
        if (response.data?.data) {
            logger(`[${extensionId}] 积分领取成功: ${JSON.stringify(response.data.data)}`, 'success');
        }
        logger(`[${extensionId}] 尝试启动新的挖矿任务...`, 'info');
        await startNewMiningTask(apiClient, extensionId);
    } catch (error) {
        if (error.response?.status === 412) {
            logger(`[${extensionId}] 积分领取失败（状态码 412），可能已领取，尝试启动新任务...`, 'warn');
            await startNewMiningTask(apiClient, extensionId);
        } else {
            logger(`[${extensionId}] 领取积分时出错: ${error.message}`, 'error');
        }
    }
}

// 启动新挖矿任务
async function startNewMiningTask(apiClient, extensionId) {
    try {
        logger(`[${extensionId}] 尝试启动新的挖矿任务...`, 'info');
        const response = await apiClient.post('/mining/start', { extension: extensionId });
        if (response.data?.data) {
            logger(`[${extensionId}] 新的挖矿任务启动成功: ${JSON.stringify(response.data.data)}`, 'success');
        } else {
            logger(`[${extensionId}] 新的挖矿任务启动失败: ${response.data?.message || '未知错误'}`, 'warn');
        }
    } catch (error) {
        logger(`[${extensionId}] 启动新的挖矿任务时出错: ${error.message}`, 'error');
    }
}

// Ping 并更新挖矿数据
async function pingAndUpdate(apiClient, extensionId) {
    try {
        const response = await apiClient.post('/extension/ping', { extension: extensionId });

        if (response.data?.data) {
            logger(`[${extensionId}] Ping 成功`, 'info');
            await getMiningData(apiClient, extensionId);
        } else {
            logger(`[${extensionId}] Ping 无有效响应`, 'warn');
        }
    } catch (error) {
        logger(`[${extensionId}] Ping 错误: ${error.message}`, 'error');
    }
}

// 启动挖矿任务
async function startMining() {
    const tokens = readFromFile('config/tokens.txt');
    const ids = readFromFile('config/id.txt');
    const proxies = readFromFile('config/proxy.txt');

    if (!tokens.length || !ids.length || !proxies.length) {
        logger('令牌、扩展 ID 或代理配置文件为空，无法启动挖矿。', 'error');
        return;
    }

    while (true) {
        logger(chalk.cyan('========= 新一轮挖矿任务开始 ========='), 'info');

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const extensionId = ids[i % ids.length];
            const proxy = proxies[i % proxies.length];
            const apiClient = createApiClient(token, proxy);

            logger(chalk.magenta(`[账户 #${i + 1}] 开始操作...`), 'info');

            try {
                logger(`[${extensionId}] 开始 Ping...`, 'info');
                await pingAndUpdate(apiClient, extensionId);

                logger(`[${extensionId}] 检查每日签到...`, 'info');
                await dailyCheckin(apiClient, extensionId);

                logger(`[${extensionId}] 检查并领取任务奖励...`, 'info');
                await checkAndClaimTask(apiClient, extensionId);

                logger(`[${extensionId}] 操作完成。`, 'success');
            } catch (error) {
                logger(`[${extensionId}] 操作失败: ${error.message}`, 'error');
            }
        }

        logger(chalk.green('等待 1 分钟后继续下一轮挖矿...'), 'info');
        await new Promise(resolve => setTimeout(resolve, 60000));
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

// 主逻辑
(async () => {
    console.log(banner);

    while (true) {
        const choice = await askUserQuestion(`请选择操作：
1. 注册并登录
2. 生成扩展 ID
3. 启动挖矿
4. 退出程序
请输入编号：`);

        if (choice === '1') {
            const emails = readFromFile('config/emails.txt');
            if (!emails.length) {
                logger('config/emails.txt 文件为空，请添加邮箱后重试。', 'error');
                continue;
            }

            const password = await askUserQuestion('请输入注册密码：');
            if (!password || password.trim().length < 8) {
                logger('密码长度必须大于等于 8 位，请重试。', 'error');
                continue;
            }

            await registerAndLoginUsers(emails, password);
        } else if (choice === '2') {
            const tokens = readFromFile('config/tokens.txt');
            if (tokens.length) {
                generateExtensionIds(tokens);
                logger('扩展 ID 生成完成。', 'success');
            } else {
                logger('令牌文件为空，请先注册并登录。', 'error');
            }
        } else if (choice === '3') {
            logger('启动挖矿任务...', 'info');
            await startMining();
        } else if (choice === '4') {
            logger('程序已退出，感谢使用！', 'info');
            break;
        } else {
            logger('无效输入，请重新选择。', 'warn');
        }
    }
})();
