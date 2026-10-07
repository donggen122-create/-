// Presentation only. UI 1 neither requests these assets nor changes its markup.
export const isUI2 = () => typeof document !== 'undefined' && document.documentElement.classList.contains('ui2');
export const UI2_ICONS = [
  'nav_adventure','nav_training','nav_parts','nav_gear','nav_friends','nav_book',
  'cur_pass','cur_coin','cur_gift','cur_star','cur_sprout','cur_crown',
  'fn_mission','fn_news','fn_settings','fn_sound_on','fn_sound_off','fn_lock','fn_time','fn_clean',
  'stat_attack','stat_hp','stat_speed','el_fire','el_water','el_earth','el_wind','el_lightning',
  'slot_helm','slot_armor','slot_gloves','slot_shoes','slot_necklace','slot_weapon',
  'btn_help','btn_close','btn_prev','btn_next','btn_check','btn_reroll',
  'supply_closed','supply_open','hud_weapon_ranged','fn_pause',
];
export const art2 = (name, cls = '') => `<img class="sg-icon sg-ui2-icon ${cls}" src="./assets/ui2/icons/${name}.png" alt="" />`;
export const symbol2 = (name, legacy) => isUI2() ? art2(name, 'sg-ui2-symbol') : legacy;
export const skillAsset = name => `./assets/${isUI2() ? 'ui2' : 'sprites'}/skills/${name}.png`;
let preloaded = false;
const images = [];
export function preloadUI2() {
  if (!isUI2() || preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  for (const path of [...UI2_ICONS.map(name => `icons/${name}.png`), 'emblem.png', 'bg_hq.jpg']) {
    const image = new Image(); image.src = `./assets/ui2/${path}`; images.push(image);
  }
}
