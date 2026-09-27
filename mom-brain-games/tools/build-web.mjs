// 토스 앱에 올릴 웹 묶음(dist/)을 만들어요. `npm run build`가 이 스크립트 다음에 `ait build`를 실행해요.
//
// - index.html, css/, js/, assets/paintings/ 를 dist/ 로 복사해요.
// - src/toss-bridge.js 를 esbuild로 묶어 dist/js/toss-bridge.js 를 만들고,
//   dist/index.html 에만 그 스크립트를 넣어요(개발용 index.html 은 그대로라서 브라우저에서 바로 열 수 있어요).
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const dir of ['css', 'js', path.join('assets', 'paintings')]) {
  await cp(path.join(root, dir), path.join(out, dir), { recursive: true });
}

await build({
  entryPoints: [path.join(root, 'src', 'toss-bridge.js')],
  outfile: path.join(out, 'js', 'toss-bridge.js'),
  bundle: true,
  format: 'iife',
  target: 'es2019',
  minify: true,
  legalComments: 'eof',
  logLevel: 'warning',
});

const appScript = '<script src="js/paintings.js"></script>';
const html = await readFile(path.join(root, 'index.html'), 'utf8');
if (!html.includes(appScript)) throw new Error('index.html 에서 js/paintings.js 스크립트를 찾지 못했어요.');
await writeFile(
  path.join(out, 'index.html'),
  html.replace(appScript, '<script src="js/toss-bridge.js"></script>\n' + appScript),
);

console.log('dist/ 를 만들었어요.');
