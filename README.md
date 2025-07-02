# 视频字幕AI总结插件

一个Chrome浏览器插件，可以自动获取并显示YouTube和Bilibili视频的字幕，并使用AI技术对字幕内容进行智能总结。

## 功能特性

### 🎯 核心功能
- **自动字幕获取**: 支持YouTube和Bilibili平台的字幕自动提取
- **多语言支持**: YouTube支持多种语言字幕切换
- **时间跳转**: 点击字幕可直接跳转到对应视频时间点
- **AI智能总结**: 使用多种AI服务对字幕内容进行总结分析

### 🤖 AI服务支持
- **OpenAI**: GPT-4, GPT-4-turbo, GPT-3.5-turbo
- **Google Gemini**: Gemini-pro, Gemini-pro-vision
- **Anthropic Claude**: Claude-3-opus, Claude-3-sonnet, Claude-3-haiku
- **GPT 兼容**

### 📱 用户界面
- **浮动面板**: 在视频页面右侧显示字幕面板
- **配置页面**: 完整的AI服务配置管理界面
- **状态显示**: 实时显示功能启用状态

## 安装使用

### 开发环境安装

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd video-mindmap
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **开发模式**
   ```bash
   pnpm dev
   ```

4. **构建插件**
   ```bash
   pnpm build
   ```

### Chrome插件安装

1. 打开Chrome浏览器，进入 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目的 `build/chrome-mv3-dev` 或 `build/chrome-mv3-prod` 目录

## 配置说明

### AI服务配置

> 📖 **详细指引**: 查看 [AI服务使用指引](./guide/index.md) 获取完整的AI服务选择和配置建议

**快速推荐：**
- 🌟 **首选**: Google Gemini（免费，效果好）
- 🔄 **备选**: 硅基流动（国内访问，部分免费）
- 💰 **高级**: OpenAI GPT 或 Anthropic Claude（付费，性能最佳）

**基本配置步骤：**

1. **打开配置页面**
   - 点击插件图标，在弹出窗口中点击"配置AI总结"按钮
   - 或者右键插件图标选择"选项"

2. **选择AI服务商**
   - 从下拉菜单中选择你要使用的AI服务商
   - 每个服务商支持不同的模型选择

3. **填写API Key**
   - 根据选择的服务商，填写对应的API Key
   - API Key获取方式：
     - **OpenAI**: 访问 [platform.openai.com](https://platform.openai.com)
     - **Google Gemini**: 访问 [ai.google.dev](https://ai.google.dev)
     - **Anthropic Claude**: 访问 [console.anthropic.com](https://console.anthropic.com)
     - **智谱AI**: 访问 [open.bigmodel.cn](https://open.bigmodel.cn)
     - **硅基流动**: 访问 [cloud.siliconflow.cn](https://cloud.siliconflow.cn)

4. **选择模型**
   - 根据需要选择合适的AI模型
   - 不同模型在性能和成本上有所差异

5. **自定义API地址**（可选）
   - 如果使用自建或代理的API服务，可以修改API地址

## 使用方法

### 观看视频

1. **访问支持的视频网站**
   - YouTube: `https://www.youtube.com/watch?v=...`
   - Bilibili: `https://www.bilibili.com/video/BV...`

2. **字幕面板自动显示**
   - 插件会自动在页面右侧显示字幕面板
   - 等待字幕加载完成

3. **使用字幕功能**
   - **查看字幕**: 滚动查看完整字幕内容
   - **时间跳转**: 点击任意字幕条目跳转到对应时间
   - **语言切换**: (YouTube) 在下拉菜单中选择不同语言

### AI总结功能

1. **启用AI总结**
   - 确保已在配置页面中启用AI功能并填写API Key

2. **生成总结**
   - 在字幕面板中点击"AI总结"按钮
   - 等待AI分析完成

3. **查看总结结果**
   - **概要**: 视频内容的简洁总结
   - **关键要点**: 提取的重要信息点
   - **主要话题**: 视频涉及的主要话题标签

4. **管理总结**
   - 点击"显示/隐藏"按钮控制总结内容的显示
   - 总结结果会保存在当前会话中

## 技术架构

### 项目结构
```
video-mindmap/
├── contents/                 # 内容脚本
│   ├── youtube-subtitle.tsx  # YouTube字幕处理
│   └── bilibili-subtitle.tsx # Bilibili字幕处理
├── utils/                    # 工具函数
│   ├── ai-service.ts        # AI服务接口
│   └── subtitle-utils.ts    # 字幕处理工具
├── config/                   # 配置文件
│   └── platforms.ts         # 平台配置
├── options.tsx              # 配置页面
├── popup.tsx                # 弹出窗口
└── package.json             # 项目配置
```

### 核心技术
- **框架**: React 18 + TypeScript
- **构建工具**: Plasmo Framework
- **存储**: Chrome Storage API
- **网络请求**: Fetch API
- **样式**: 内联样式 (避免样式冲突)

## 注意事项

### 隐私安全
- API Key仅存储在本地浏览器中，不会上传到任何服务器
- 字幕内容仅在使用AI总结时发送给选择的AI服务商
- 插件不会收集或存储用户的个人信息

### 使用限制
- AI总结功能需要有效的API Key和网络连接
- 不同AI服务商有不同的使用限制和计费方式
- 部分视频可能没有字幕或字幕获取失败

### 兼容性
- 支持Chrome浏览器 (Manifest V3)
- 需要YouTube和Bilibili网站的访问权限
- 建议使用最新版本的浏览器

## 故障排除

### 常见问题

1. **字幕无法显示**
   - 检查视频是否有字幕
   - 刷新页面重试
   - 检查插件是否正确安装

2. **AI总结失败**
   - 检查API Key是否正确
   - 检查网络连接
   - 检查AI服务商的服务状态
   - 查看浏览器控制台的错误信息

3. **配置无法保存**
   - 检查浏览器的存储权限
   - 尝试重新安装插件

### 调试方法

1. **开启开发者工具**
   - 按F12打开浏览器开发者工具
   - 查看Console标签页的错误信息

2. **检查插件状态**
   - 访问 `chrome://extensions/`
   - 查看插件是否正常启用
   - 检查插件的错误信息

## 开发贡献

### 开发环境
- Node.js 16+
- pnpm 包管理器
- TypeScript 5+

### 贡献指南
1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证。详见 LICENSE 文件。

## 更新日志

### v0.0.1
- 初始版本发布
- 支持YouTube和Bilibili字幕获取
- 集成多种AI服务商
- 完整的配置管理界面
