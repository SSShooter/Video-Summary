# Intelligent Content Analysis Assistant

[中文文档](./README.zh.md) | English

A powerful Chrome browser extension that integrates AI technology to provide intelligent analysis and visualization of video and article content.

## 🚀 Three Core Features

### 🎬 Intelligent Video Content Summarization

**Supports Both YouTube and Bilibili Platforms**

- Automatically extracts video subtitle content with multi-language subtitle switching support
- One-click AI-powered video content summarization including overview, key points, and main topics
- Click subtitles to jump directly to corresponding video timestamps, improving viewing efficiency
- Smart caching mechanism to avoid duplicate generation and save API call costs

### 📄 Intelligent Article Content Analysis

**Comprehensive Text Content Processing Capabilities**

- Supports automatic extraction and analysis of web article content
- Uses multiple AI services for content summarization and analysis
- Provides structured content analysis including main viewpoints, key information, and topic tags
- Supports multiple AI model selection to meet different accuracy and cost requirements

### 🧠 Visual Mind Map Generation

**Transform Content into Intuitive Mind Maps**

- Automatically generates structured mind maps based on video or article content
- Supports mind map export and save functionality
- Provides clear information hierarchy for better understanding and memory
- Integrates professional mind map components with interactive browsing and editing support

## ✨ Technical Highlights

- 🔒 **Privacy & Security**: API Keys stored locally only, no server uploads
- 💾 **Smart Caching**: Automatically saves analysis results for enhanced user experience
- 🎨 **Unified UI Design**: Consistent visual style and interactive experience
- 🌐 **Multi-Platform Support**: YouTube, Bilibili, and other mainstream video platforms
- ⚡ **High Performance**: Optimized data processing and rendering mechanisms

## Configuration Guide

### AI Service Configuration

> 📖 **Detailed Guide**: Check [AI Service Usage Guide](./guide/index.md) for complete AI service selection and configuration recommendations

**Quick Recommendations:**

- 🌟 **First Choice**: Google Gemini (Free, excellent results)
- 🔄 **Alternative**: SiliconFlow, partially free OpenRouter
- 💰 **Premium**: OpenAI GPT or Anthropic Claude (Paid, best performance)

## Technical Architecture

### Project Structure

```
video-mindmap/
├── contents/                 # Content scripts
│   ├── youtube-subtitle.tsx  # YouTube subtitle processing
│   └── bilibili-subtitle.tsx # Bilibili subtitle processing
├── utils/                    # Utility functions
│   ├── ai-service.ts        # AI service interface
│   └── subtitle-utils.ts    # Subtitle processing tools
├── config/                   # Configuration files
│   └── platforms.ts         # Platform configuration
├── options.tsx              # Configuration page
├── popup.tsx                # Popup window
└── package.json             # Project configuration
```

### Core Technologies

- **Framework**: React 18 + TypeScript
- **Build Tool**: Plasmo Framework
- **Storage**: Chrome Storage API
- **Network Requests**: Fetch API
- **Styling**: Inline styles (to avoid style conflicts)

## Important Notes

### Privacy & Security

- API Keys are stored only in the local browser and are never uploaded to any server
- Subtitle content is only sent to selected AI service providers when using AI summarization
- The extension does not collect or store users' personal information

### Usage Limitations

- AI summarization features require valid API Keys and network connection
- Different AI service providers have different usage limits and billing methods
- Some videos may not have subtitles or subtitle extraction may fail

## Troubleshooting

### Common Issues

1. **Subtitles Not Displaying**

   - Check if the video has subtitles available
   - Refresh the page and try again

2. **AI Summarization Failed**

   - Check if the API Key is correct
   - Check network connection
   - Check the AI service provider's service status
