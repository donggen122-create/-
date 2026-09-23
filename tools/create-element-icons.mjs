import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

// Original code-native icons. Silhouettes differ by attack behavior as well as color.
const out=resolve(dirname(fileURLToPath(import.meta.url)),'../game/assets/elements_v2/icons');
await mkdir(out,{recursive:true});
const palette={fire:'#e76c3b',water:'#278ebd',wind:'#38ab96',earth:'#b88848',lightning:'#9c7be9'};
const ink='#263e53',white='#f9fdff';
const p=(d,fill='currentColor',extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
const c=(x,y,r,fill='currentColor',extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const l=d=>p(d,'none','stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"');
const rect=(x,y,w,h,r,fill='currentColor',extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const shapes={
 fire:p('M34 10C38 24 53 29 50 42C48 54 32 59 22 50C13 41 19 30 28 23C28 30 32 33 34 31C36 27 30 21 34 10Z')+p('M34 34C42 41 41 49 33 50C25 51 23 44 29 39L30 44Z',white),
 water:p('M32 9C27 18 15 29 15 39C15 50 23 56 33 56C44 56 51 49 50 39C49 29 38 19 32 9Z')+l('M23 41Q25 48 33 48'),
 wind:l('M12 25H42Q54 25 50 17Q46 11 40 17M9 35H47Q59 35 54 45Q50 51 44 45M16 45H31Q40 45 37 54'),
 earth:p('M15 29L30 14L45 21L54 40L43 52H20L10 42Z')+p('M30 14L31 34L54 40M31 34L20 52M31 34L15 29','none',`stroke="${white}" stroke-width="3" opacity=".65"`),
 lightning:p('M35 6L13 36H29L24 58L52 25H35L40 6Z')
};
const skill={
 F1:c(35,34,14)+p('M25 22L8 11L17 30L6 29L21 41Z')+c(39,31,5,white)+l('M48 48L53 53M49 16L54 11'),
 F2:`<ellipse cx="32" cy="41" rx="24" ry="11" fill="none" stroke="currentColor" stroke-width="7"/>`+p('M16 39Q8 29 21 18Q19 29 27 29Q30 20 35 11Q43 24 38 32Q51 26 47 41L38 36L31 43L24 37Z'),
 F3:p('M23 31L49 7L42 29L57 22L43 44Z')+c(26,40,15)+c(24,37,6,white)+l('M9 53L5 57M48 50L55 56'),
 W1:p('M13 50L40 23L35 18L57 7L47 30L42 25L16 53Z')+l('M9 39L29 19M22 56L40 38'),
 W2:p('M7 46C15 42 13 20 32 17C44 15 50 28 46 34C41 25 35 28 34 34C37 47 50 41 57 40L57 51H7Z')+l('M11 55H52'),
 W3:`<ellipse cx="32" cy="32" rx="25" ry="15" fill="none" stroke="currentColor" stroke-width="3" transform="rotate(-30 32 32)"/>`+c(32,32,6,ink)+p('M13 20Q5 29 8 34Q14 41 20 34Q22 29 13 20Z')+p('M49 28Q40 38 43 44Q49 51 56 44Q59 39 49 28Z'),
 V1:p('M8 20L56 7L43 55L34 33Z')+p('M16 21L37 27L44 45L45 18Z',white)+l('M9 44Q9 54 22 53M9 44L7 50M9 44L15 46'),
 V2:l('M10 18Q32 6 53 18Q59 25 31 27Q13 29 17 33Q21 38 43 37Q52 42 24 46Q18 50 35 55'),
 V3:p('M32 31L25 15L32 5L39 15Z')+p('M22 42L9 39L4 24L19 29Z')+p('M42 42L45 29L60 24L55 39Z')+l('M30 53V42M23 56L19 50M41 56L45 50'),
 E1:`<ellipse cx="32" cy="32" rx="25" ry="17" fill="none" stroke="currentColor" stroke-width="3"/>`+c(32,32,6,ink)+p('M7 22L18 16L26 25L19 35L8 32Z')+p('M41 35L51 29L59 39L52 49L42 46Z')+l('M15 23L19 28M46 37L51 40'),
 E2:p('M21 22L34 13L47 20L52 37L38 46L22 40L15 31Z')+p('M34 13L33 30L52 37M33 30L22 40','none',`stroke="${white}" stroke-width="3"`)+l('M10 44L5 51M30 6V11M49 8L46 13M24 53H49M8 57H56'),
 E3:p('M7 53L17 25L28 53Z')+p('M24 53L36 11L47 53Z')+p('M42 53L53 30L61 53Z')+l('M5 57H59')+p('M36 19L32 45H37Z',white),
 L1:l('M6 19L19 13L28 29L39 21L50 44L58 39')+c(7,19,5)+c(26,29,5)+c(39,21,5)+c(50,44,5)+l('M18 45L24 39M35 54L40 49'),
 L2:`<circle cx="33" cy="45" r="15" fill="none" stroke="currentColor" stroke-width="3"/>`+p('M34 5L20 28H32L27 46L47 22H36L42 5Z')+l('M5 45H14M52 45H59M33 58V62'),
 L3:rect(10,14,44,40,9,'none','stroke="currentColor" stroke-width="3"')+p('M34 16L20 37H31L27 51L46 29H34L39 16Z')+c(10,14,4)+c(54,54,4)+l('M16 7H45M19 60H43')
};
const combo={
 COMBO_01:p('M9 43L22 30L35 37L22 51Z')+p('M24 28L48 17L55 29L35 40Z')+l('M36 13Q30 7 38 4M49 12Q43 7 51 3M39 49L56 44')+c(52,21,4,white),
 COMBO_02:p('M8 27L55 8L41 55L33 34Z')+p('M13 26Q18 12 31 10L26 22L39 17L34 31Z',white)+l('M10 46Q18 59 30 50'),
 COMBO_03:`<ellipse cx="32" cy="35" rx="24" ry="17" fill="none" stroke="currentColor" stroke-width="3"/>`+p('M9 27L18 16L29 25L24 40L12 42Z')+p('M40 32L50 23L58 33L53 48L41 49Z')+p('M19 18L18 32L25 34M49 25L47 37L56 40','none',`stroke="${white}" stroke-width="3"`),
 COMBO_04:`<ellipse cx="32" cy="42" rx="24" ry="11" fill="none" stroke="currentColor" stroke-width="6"/>`+p('M34 8L20 32H32L26 46L48 24H36L40 8Z')+l('M8 28L12 18M53 28L56 17'),
 COMBO_05:p('M7 54L24 27H39L58 54Z')+p('M23 28L29 38L33 33L38 41L41 33L39 27Z',white)+c(27,14,5)+c(44,20,4)+l('M32 7V16M15 12L21 19M49 7L43 14'),
 COMBO_06:p('M7 47Q13 45 18 28Q27 14 40 24Q48 33 40 37Q35 25 29 35Q32 49 56 41V54H7Z')+l('M22 17Q14 13 22 7M36 13Q30 7 38 3M51 22Q46 16 52 10'),
 COMBO_07:p('M10 49L37 24L31 21L57 6L45 33L42 28L16 55Z')+p('M18 35L31 26L29 36L43 31L30 46L32 37Z',white)+l('M7 28L17 23M37 55L49 47'),
 COMBO_08:l('M10 20Q34 9 52 18Q59 25 29 28Q14 30 19 35Q27 38 43 38Q53 43 26 48L34 54')+l('M19 8V17M15 10L23 15M23 10L15 15M50 43V55M44 46L56 52M56 46L44 52'),
 COMBO_09:p('M16 50L12 33L20 20L28 36L25 51Z')+p('M31 51L26 20L35 8L43 24L40 51Z')+p('M44 52L42 34L51 22L57 36L53 52Z')+`<ellipse cx="32" cy="54" rx="28" ry="5" fill="none" stroke="currentColor" stroke-width="3"/>`,
 COMBO_10:p('M12 29Q6 13 23 15Q33 4 44 17Q59 15 57 30Z')+p('M33 27L21 43H31L26 59L46 36H34L39 27Z')+l('M13 37L9 46M50 40L46 48'),
 COMBO_11:`<ellipse cx="32" cy="32" rx="25" ry="15" fill="none" stroke="currentColor" stroke-width="4" transform="rotate(-27 32 32)"/>`+p('M9 35L18 16L25 38Z')+p('M40 45L48 24L57 45Z')+c(30,24,2)+c(35,39,2)+c(40,17,2)+c(22,46,2),
 COMBO_12:l('M11 17Q34 9 54 17Q58 24 31 27Q11 30 23 36Q40 35 46 40Q46 45 27 48')+p('M34 15L25 33H36L29 57L49 32H38L42 15Z',white),
 COMBO_13:p('M8 42L27 25L38 36L18 55Z')+p('M31 23L39 13L50 20L48 33L37 36Z')+p('M45 6L54 4L59 13L51 19Z')+l('M8 25L22 18M25 9L32 5M35 52L53 39'),
 COMBO_14:p('M31 6L23 24L32 22L25 43L44 17H34L39 6Z')+p('M10 25L4 40L14 38L12 53L25 33H16L19 25Z')+p('M50 26L43 43L51 40L48 56L62 37H55L59 26Z'),
 COMBO_15:p('M6 42L18 25L28 36L37 20L57 36L53 53L36 47L21 56L8 51Z')+p('M34 10L26 29L36 27L27 53L47 27H37L42 10Z',white)+l('M6 18L13 14M48 9L53 15')
};
function svg(body,color,label,kind='skill'){
  const badge=kind==='part'?`<path d="M51 44L56 47V55L51 58L46 55V47Z" fill="${ink}"/><circle cx="51" cy="51" r="3" fill="${white}"/>`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${label}"><title>${label}</title><rect x="1" y="1" width="62" height="62" rx="13" fill="${color}" fill-opacity=".11" stroke="${color}" stroke-opacity=".28"/><g color="${color}" stroke-linejoin="round" stroke-linecap="round">${body}</g>${badge}</svg>\n`;
}
const jobs=[];
for(const [id,body] of Object.entries(shapes))jobs.push([`element_${id}`,svg(body,palette[id],id)]);
const skillNames={F1:'화염탄',F2:'화염 고리',F3:'유성 낙하',W1:'물의 창',W2:'파도',W3:'물방울 위성',V1:'칼바람',V2:'회오리',V3:'돌풍탄',E1:'바위 위성',E2:'암석 낙하',E3:'대지창',L1:'연쇄 번개',L2:'낙뢰',L3:'전기장'};
const skillElement=id=>({F:'fire',W:'water',V:'wind',E:'earth',L:'lightning'})[id[0]];
for(const [id,body] of Object.entries(skill)){
  const color=palette[skillElement(id)];jobs.push([`skill_${id}`,svg(body,color,skillNames[id])]);
  const circuit=`<g transform="translate(10 9) scale(.72)">${body}</g><path d="M8 45V51H34M48 9H56V27M8 29H12M29 7V12" stroke="${ink}" stroke-width="3" fill="none"/><circle cx="8" cy="45" r="3" fill="${ink}"/><circle cx="56" cy="27" r="3" fill="${ink}"/>`;
  jobs.push([`part_PART_${id}`,svg(circuit,color,`${skillNames[id]} 파츠`,'part')]);
}
const comboNames=['증기포','화염칼날','용암 위성','플라즈마장','화산 폭격','증기 해일','전류창','서리 태풍','수정 샘','뇌우','사막 위성','천둥 폭풍','사암포','뇌격 산탄','자력 균열'];
const pairs=[['fire','water'],['fire','wind'],['fire','earth'],['fire','lightning'],['fire','earth'],['fire','water'],['water','lightning'],['water','wind'],['water','earth'],['water','lightning'],['wind','earth'],['wind','lightning'],['wind','earth'],['wind','lightning'],['earth','lightning']];
Object.entries(combo).forEach(([id,body],i)=>{
 const [a,b]=pairs[i].map(x=>palette[x]);const content=`<defs><linearGradient id="mix" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><g color="${a}">${body}</g><rect x="8" y="58" width="48" height="3" rx="1.5" fill="url(#mix)"/><circle cx="56" cy="8" r="5" fill="${b}" stroke="${white}" stroke-width="2"/>`;
 jobs.push([`combo_${id}`,svg(content,a,comboNames[i],'combo')]);
});
jobs.push(['mode_melee',svg(p('M21 45L43 12L54 8L53 21L31 48Z')+p('M18 40L37 52L32 57L13 45Z',ink)+p('M21 48L13 60L7 56L15 44Z',ink),'#4785a1','근거리')]);
jobs.push(['mode_ranged',svg(c(22,38,13)+p('M31 24L47 15L44 9L59 13L53 29L50 23L36 31Z')+l('M9 9L20 18M5 22L14 26M36 47L46 55')+p('M10 36Q24 34 27 48M19 26Q20 38 34 40','none',`stroke="${white}" stroke-width="2.5"`),'#4785a1','원거리')]);
await Promise.all(jobs.map(([id,body])=>writeFile(resolve(out,`${id}.svg`),body,'utf8')));
if(jobs.length!==52)throw new Error(`Expected 52 icons, got ${jobs.length}`);
console.log(`Created ${jobs.length} original element icons in ${out}`);
