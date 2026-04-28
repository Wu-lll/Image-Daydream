# Image Daydream Render 部署说明

## 部署配置

本项目已包含 `render.yaml`，Render 识别后会使用：

```text
Build Command: npm install && npm run build
Start Command: npm start
Health Check Path: /api/health
```

## 必填环境变量

在 Render 服务的 Environment 页面添加：

```env
ACCESS_CODE=你要分享给朋友的访问口令
SESSION_SECRET=一段足够长的随机字符串
SESSION_TTL_HOURS=36
SESSION_MAX_AGE_DAYS=30

LINE1_LABEL=线路 1
LINE1_BASE_URL=https://api.pptoken.org/v1
LINE1_API_KEY=你的线路1 API Key
LINE1_MODEL=gpt-image-2

LINE2_LABEL=线路 2
LINE2_BASE_URL=https://www.souimagery.fun/v1
LINE2_API_KEY=你的线路2 API Key
LINE2_MODEL=gpt-image-2
```

## 注意事项

- 不要把真实 API Key 写进 GitHub。
- 后续修改访问口令，只改 Render 的 `ACCESS_CODE` 并重启服务。
- 如果要强制所有旧登录失效，同时更换 `SESSION_SECRET`。
- 免费 Render 服务空闲后会休眠，第一次打开可能需要等待冷启动。
- 生成图片不保存在服务器，历史记录只保存在用户浏览器本地。

