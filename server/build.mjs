// 전시관 화면 파일을 dist 폴더로 모아요. Cloudflare Pages 에는 이 폴더만 올라가요.
import { cpSync, mkdirSync, rmSync } from "node:fs";

const FILES = ["index.html", "play.html", "register.html", "404.html", "config.js", "assets"];
const root = new URL("../", import.meta.url);
const dist = new URL("./dist/", import.meta.url);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const name of FILES) cpSync(new URL(name, root), new URL(name, dist), { recursive: true });
console.log(`전시관 화면을 server/dist 에 모았어요: ${FILES.join(", ")}`);
