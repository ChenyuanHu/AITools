import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const REQUEST_TIMEOUT = 5 * 60 * 1000; // 5分钟超时

export async function POST(request: NextRequest) {
  const requestId = `proxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[Next.js代理][${requestId}] ========== 代理请求开始 ==========`);
  console.log(`[Next.js代理][${requestId}] 后端URL: ${BACKEND_URL}`);
  
  try {
    // 获取请求的授权头
    const authHeader = request.headers.get('authorization');
    console.log(`[Next.js代理][${requestId}] 授权头: ${authHeader ? '已设置' : '未设置'}`);
    
    // 获取请求体（FormData）
    console.log(`[Next.js代理][${requestId}] 开始读取FormData...`);
    const formData = await request.formData();
    
    // 创建新的FormData用于转发到后端
    const backendFormData = new FormData();
    let fieldCount = 0;
    
    // 复制所有字段到新的FormData
    for (const [key, value] of formData.entries()) {
      fieldCount++;
      // 检查是否为 File 对象：在 Node.js 环境中，File 可能不是全局的
      // 使用类型检查：File 对象有 size 和 type 属性，而字符串没有
      const isFile = value && typeof value === 'object' && 'size' in value && 'type' in value;
      if (isFile) {
        backendFormData.append(key, value as File);
        const fileValue = value as File;
        console.log(`[Next.js代理][${requestId}] 字段[${fieldCount}]: ${key} (File, ${fileValue.size} bytes)`);
      } else {
        backendFormData.append(key, value as string);
        const strValue = value as string;
        console.log(`[Next.js代理][${requestId}] 字段[${fieldCount}]: ${key} (${strValue.length > 100 ? strValue.substring(0, 100) + '...' : strValue})`);
      }
    }
    console.log(`[Next.js代理][${requestId}] ✅ FormData处理完成，共 ${fieldCount} 个字段`);
    
    // 转发请求到后端，设置更长的超时时间（5分钟）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`[Next.js代理][${requestId}] ⏱️  请求超时（${REQUEST_TIMEOUT}ms）`);
      controller.abort();
    }, REQUEST_TIMEOUT);
    
    const fetchStartTime = Date.now();
    console.log(`[Next.js代理][${requestId}] 📤 开始转发请求到后端...`);
    
    try {
      const backendResponse = await fetch(`${BACKEND_URL}/api/generate/stream`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader || '',
        },
        body: backendFormData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const fetchDuration = Date.now() - fetchStartTime;
      console.log(`[Next.js代理][${requestId}] ✅ 后端响应收到，状态: ${backendResponse.status}, 耗时: ${fetchDuration}ms`);
      
      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        console.error(`[Next.js代理][${requestId}] ❌ 后端响应错误: ${backendResponse.status}`, errorText);
        return new Response(errorText, {
          status: backendResponse.status,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      
      // 检查响应体是否为流
      if (!backendResponse.body) {
        console.error(`[Next.js代理][${requestId}] ❌ 后端响应体为空`);
        return new Response(
          JSON.stringify({ error: '后端响应体为空' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
      
      console.log(`[Next.js代理][${requestId}] 📥 开始转发流式响应...`);
      
      // 返回流式响应
      return new Response(backendResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const fetchDuration = Date.now() - fetchStartTime;
      
      if (fetchError.name === 'AbortError') {
        console.error(`[Next.js代理][${requestId}] ❌ 请求超时，耗时: ${fetchDuration}ms`);
        return new Response(
          JSON.stringify({ error: '请求超时，请稍后重试' }),
          {
            status: 504,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
      
      console.error(`[Next.js代理][${requestId}] ❌ 转发请求失败，耗时: ${fetchDuration}ms`);
      console.error(`[Next.js代理][${requestId}] ❌ 错误类型: ${fetchError.constructor.name}`);
      console.error(`[Next.js代理][${requestId}] ❌ 错误消息: ${fetchError.message}`);
      console.error(`[Next.js代理][${requestId}] ❌ 错误堆栈:`, fetchError.stack);
      console.error(`[Next.js代理][${requestId}] ❌ 错误详情:`, {
        code: fetchError.code,
        errno: fetchError.errno,
        syscall: fetchError.syscall,
      });
      
      return new Response(
        JSON.stringify({ 
          error: '代理请求失败',
          message: fetchError.message 
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error: any) {
    console.error(`[Next.js代理][${requestId}] ❌ 处理请求失败`);
    console.error(`[Next.js代理][${requestId}] ❌ 错误类型: ${error.constructor.name}`);
    console.error(`[Next.js代理][${requestId}] ❌ 错误消息: ${error.message}`);
    console.error(`[Next.js代理][${requestId}] ❌ 错误堆栈:`, error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: '处理请求失败',
        message: error.message 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

