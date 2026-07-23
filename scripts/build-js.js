// scripts/build-js.js
// esbuild 打包前端 JS 为 2 个 bundle：home + admin
import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function build() {
  const start = Date.now();

  await esbuild.build({
    entryPoints: [
      resolve(root, 'public/js/main.js'),
      resolve(root, 'public/js/admin.js'),
    ],
    bundle: true,
    outdir: resolve(root, 'public/dist'),
    format: 'esm',
    minify: true,
    sourcemap: true,
    splitting: true,
    target: ['es2020'],
  });

  console.log(`JS bundle built in ${Date.now() - start}ms`);
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
