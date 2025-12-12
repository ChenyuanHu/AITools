/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 使用 rewrites 将 API 请求代理到后端
  // 注意：/api/generate/stream 使用自定义 API 路由（app/api/generate/stream/route.ts），
  // 支持更长的超时时间（5分钟），避免 Gemini API 长时间调用导致的超时问题
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  env: {
    // 前端使用相对路径，避免跨域问题
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  // 禁用图片优化（因为我们使用的是 base64 图片）
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig

