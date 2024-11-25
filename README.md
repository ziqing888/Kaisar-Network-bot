# Kaisar-Network-Bot

🚀 **Kaisar-Network-Bot** 是一个自动化脚本，用于在 [Kaisar](https://zero.kaisar.io/register?ref=LRYXCv620) 平台上进行挖矿、每日签到、任务奖励领取等操作。
---

## 功能列表

- **注册和登录**
  - 批量从 `emails.txt` 文件读取邮箱，注册并登录账号。
  - 支持自动生成令牌并保存到本地。
- **每日签到**
  - 检查并完成每日签到任务。
  - 自动处理重复签到情况。
- **任务奖励领取**
  - 自动检查任务奖励并完成领取。
- **挖矿任务**
  - 自动开始挖矿任务。
  - 挖矿任务完成后自动领取积分并启动新的任务。
- **日志记录**
  - 全面记录操作日志，包括成功、警告和错误信息，便于排查问题。

---

## 使用说明

### 1. 克隆或下载项目
```bash
git clone https://github.com/ziqing888/kaisar-bot.git
cd kaisar-bot
```
### 2. 安装依赖
确保已安装 Node.js 和 npm，然后运行：
```
npm install
```
### 3. 配置文件
将以下配置文件添加到 config 文件夹中：

emails.txt：账号邮箱列表（用于批量注册和登录）。

tokens.txt：登录成功后保存的令牌文件。

id.txt：生成的扩展 ID 文件。

proxy.txt（可选）：HTTP 代理列表。
### 4. 运行脚本
启动脚本：
```
npm start
```
### 作者
### 👤 作者：@qklxsqf
### 📢 电报频道：https://t.me/ksqxszq


