// 本地开发：写入管理员凭证到本地 KV
// 用法: node scripts/setup-admin.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { createHash } from "crypto";

const KV_DIR = resolve(import.meta.dirname, "../.wrangler/state/v3/kv/NAV_AUTH/blobs");

if (!existsSync(KV_DIR)) {
  mkdirSync(KV_DIR, { recursive: true });
}

function blobPath(key) {
  const hash = createHash("sha256").update(key).digest("hex");
  // Miniflare v3 uses timestamp suffix
  const timestamp = Date.now().toString(16).padStart(16, "0");
  return resolve(KV_DIR, `${hash}000001${timestamp}`);
}

// 写入凭证
const credentials = {
  admin_username: "admin",
  admin_password: "admin123",
};

for (const [key, value] of Object.entries(credentials)) {
  const path = blobPath(key);
  writeFileSync(path, value);
  console.log(`Wrote: ${key} = ${value} -> ${path}`);
}

console.log("\n管理员账号已创建:");
console.log("  用户名: admin");
console.log("  密码: admin123");
console.log("\n请重启 wrangler pages dev 使配置生效");
