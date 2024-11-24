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

// UUID 生成
function generateUUID() {
    return crypto.randomUUID();
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
        config.httpsAgent = new HttpsProxyAgent(proxy);
    }

    return axios.create(config);
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

// 用户注册
async function registerUser(email, password) {
    try {
        const response = await axios.post(
            'https://zero-api.kaisar.io/auth/register',
            { email, password, inviteCode: INVITE_CODE }, // 邀请码直接传递
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

// 批量注册和登录
async function registerAndLoginUsers(emails, password) {
    for (const email of emails) {
        logger(`正在处理用户 ${email} 的注册和登录...`, 'info');
        await registerUser(email, password);
    }
}

// 动态用户交互逻辑
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
    logger('欢迎使用挖矿自动化工具！', 'info');

    const userChoice = await askUserQuestion('请选择操作：\n1. 注册并登录\n2. 开始挖矿\n请输入选项编号（1或2）：');
    if (userChoice === '1') {
        const emails = readFromFile('config/emails.txt');
        if (!emails.length) {
            logger('config/emails.txt 文件为空，请添加邮箱后重试。', 'error');
            return;
        }

        const password = await askUserQuestion('请输入默认注册密码：');
        await registerAndLoginUsers(emails, password || '默认密码123');
    }

    const tokens = readFromFile('config/tokens.txt');
    if (!tokens.length) {
        logger('未找到令牌，请先注册并登录。', 'error');
        return;
    }

    const proxies = readFromFile('config/proxy.txt');
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const proxy = proxies.length ? proxies[i % proxies.length] : null;

        logger(`正在处理令牌 ${i + 1}，代理：${proxy || '无'}`, 'info');

        // 挖矿、检查任务和签到逻辑
        // ...
    }

    logger('所有操作已完成！', 'success');
})();
