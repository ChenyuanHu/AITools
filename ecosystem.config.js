// PM2 生态系统配置文件
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'ai-tools-backend',
      script: path.join(__dirname, 'backend', 'server.js'),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: path.join(__dirname, 'logs', 'backend-error.log'),
      out_file: path.join(__dirname, 'logs', 'backend-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'ai-tools-frontend',
      script: 'npm',
      args: 'start',
      cwd: path.join(__dirname, 'frontend'),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // 后端地址，用于 Next.js rewrites 代理
        BACKEND_URL: 'http://localhost:3001',
        // 不设置 NEXT_PUBLIC_API_URL，使用相对路径避免跨域
      },
      error_file: path.join(__dirname, 'logs', 'frontend-error.log'),
      out_file: path.join(__dirname, 'logs', 'frontend-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};

