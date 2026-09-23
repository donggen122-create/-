import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const art={
  seed:['#d9efce','<path d="M32 51V30M32 37C15 37 12 24 13 14C25 14 35 23 32 37ZM32 30C32 18 42 11 54 12C53 26 44 32 32 30Z" fill="#67ad72"/>'],
  water:['#d7eef5','<path d="M32 9C27 20 16 28 16 39a16 16 0 0032 0C48 28 37 20 32 9Z" fill="#72c6e6"/><path d="M23 39c0 5 3 8 7 9" fill="none" stroke="white"/>'],
  watergun:['#d9edf6','<path d="M12 22h33v21H30l-4 12H15l3-20h-6Z" fill="#79c4dc"/><path d="M45 25h10v12H45Z" fill="#f1c365"/><rect x="23" y="12" width="19" height="14" rx="5" fill="#a6e6de"/><path d="M13 31h22M25 43h8" fill="none"/>'],
  grabber:['#e5e8f6','<path d="M18 13l25 34M46 13L22 48" fill="none" stroke-width="6"/><path d="M41 39l12 3-2 12M25 40l-12 3 2 12" fill="none"/><circle cx="18" cy="13" r="6" fill="#f6c97b"/><circle cx="46" cy="13" r="6" fill="#f6c97b"/>'],
  broom:['#f5e8c7','<path d="M43 9L27 35" stroke="#ad7952" stroke-width="8"/><path d="M25 30l16 10-9 16-24-15Z" fill="#e7ba63"/><path d="M15 42l10-8M21 47l11-9M27 52l10-9" fill="none" stroke-width="2"/>'],
  pinwheel:['#e9def4','<path d="M32 31v27" fill="none" stroke-width="5"/><path d="M31 31L11 21 25 7l7 24 12-21 13 14-25 8 20 12-14 11-6-23-13 20L8 38Z" fill="#a895d7"/><circle cx="32" cy="31" r="5" fill="#f8d886"/>'],
  wind:['#e7eaf6','<path d="M9 26h33c16 0 13-19 3-15M9 35h42M14 43h18c13 0 11 16 3 12" fill="none" stroke="#829bc8" stroke-width="6"/>'],
  handle:['#e5e7ea','<path d="M20 51V17c0-13 25-13 25 0v14H32V18H20" fill="#d1ae78"/><path d="M14 39h24v14H14Z" fill="#73aa94"/>'],
  sun:['#faedc8','<circle cx="32" cy="32" r="13" fill="#f3c564"/><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13 13l6 6M45 45l6 6M13 51l6-6M45 19l6-6" fill="none"/>'],
  pass:['#dcebf7','<path d="M10 16h44v12a6 6 0 000 12v9H10v-9a6 6 0 000-12Z" fill="#92c8df"/><path d="M39 18v29" fill="none" stroke-dasharray="3 4"/><path d="M21 31l5 5 8-10" fill="none" stroke="white" stroke-width="4"/>'],
  gift:['#f5e1d6','<path d="M13 30h38v26H13Z" fill="#eaaa89"/><path d="M9 22h46v11H9Z" fill="#efbb99"/><path d="M27 22h10v34H27Z" fill="#7fb798"/><path d="M32 22C11 23 16 1 27 13ZM32 22C53 23 48 1 37 13Z" fill="#7fb798"/>'],
  coin:['#fbefd0','<circle cx="32" cy="32" r="23" fill="#f0c560"/><circle cx="32" cy="32" r="16" fill="none" stroke="#c69431"/><path d="M32 19l4 8 9 1-7 7 2 10-8-5-8 5 2-10-7-7 9-1Z" fill="#ffe6a0" stroke="none"/>'],
  heart:['#f5e0dc','<path d="M32 52L12 32C-1 14 22 2 32 19 42 2 65 14 52 32Z" fill="#df928b"/><path d="M18 22c0-4 5-7 9-3" fill="none" stroke="white"/>'],
  shirt:['#e3eeda','<path d="M21 12L8 20l5 15 8-4v24h22V31l8 4 5-15-13-8c-2 9-20 9-22 0Z" fill="#92b985"/><path d="M30 35c0-9 9-9 12-8-1 9-5 13-12 8Z" fill="#e7eed1"/>'],
  boots:['#ede7d9','<path d="M13 11h20v28h17c9 0 10 15 0 15H13Z" fill="#b39577"/><path d="M13 45h43M15 18h15M23 28h10" fill="none"/><path d="M33 11h8v26h-8Z" fill="#d6bc8c"/>'],
  map:['#e2eedb','<path d="M8 17l16-7 16 7 16-7v39l-16 7-16-7-16 7Z" fill="#b5cc97"/><path d="M24 10v39M40 17v39" fill="none" stroke="#7eab78"/><path d="M16 37l10-8 13 10 8-14" fill="none" stroke="#fffbdd" stroke-dasharray="3 4"/>'],
  book:['#e3eaf2','<path d="M7 13c13-5 20-3 25 2 5-5 12-7 25-2v39c-12-5-20-4-25 1-5-5-13-6-25-1Z" fill="#acc8d2"/><path d="M32 15v38M14 22l10 2M40 24l10-2M14 32l10 2M40 34l10-2" fill="none"/>'],
  shield:['#dcece4','<path d="M32 8l22 8v16c0 14-14 21-22 26C24 53 10 46 10 32V16Z" fill="#83bfa5"/><path d="M21 32l8 8 16-19" fill="none" stroke="white" stroke-width="5"/>'],
  spark:['#faf0ce','<path d="M32 7l7 17 18 8-18 7-7 18-7-18-18-7 18-8Z" fill="#ebc767"/><path d="M50 7v10M45 12h10" fill="none"/>'],
  arrow:['#e5f0dd','<path d="M12 32h37M37 18l14 14-14 14" fill="none" stroke="#488568" stroke-width="6"/>'],
};
const dest=path.join(root,'game/assets/seoho_v1/icons');await fs.mkdir(dest,{recursive:true});
for(const [id,[bg,body]] of Object.entries(art))await fs.writeFile(path.join(dest,`${id}.svg`),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="17" fill="${bg}"/><g stroke="#3a5b51" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`);
console.log(`Created ${Object.keys(art).length} original SVG icons.`);
