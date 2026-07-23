// Temporary: create admin credentials in local KV
export async function onRequest(context) {
  const { env } = context;
  await env.NAV_AUTH.put('admin_username', 'admin');
  await env.NAV_AUTH.put('admin_password', 'admin123');
  return new Response('OK - Admin created: admin / admin123', { status: 200 });
}
