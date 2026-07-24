// functions/lib/response.js
// 标准 HTTP 响应工具函数

export function errorResponse(message, status) {
  return new Response(JSON.stringify({ code: status, message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
