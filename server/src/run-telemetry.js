// Optional, anonymous diagnostics. Invalid diagnostics never reject a settlement.
export const SCREEN_BUCKETS = [320, 375, 768, 1024, 1280, 1600];
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const finite = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
const small = x => { try { return new TextEncoder().encode(JSON.stringify(x)).length <= 1024; } catch { return false; } };
export function validatePerf(p) {
 if (!object(p) || !small(p)) return null;
 const fields = ['v','fps','p1','long33','long50','q','ratio','qmax','dev','w','h','dpr','sec'];
 if (Object.keys(p).length !== fields.length || fields.some(k => !Object.hasOwn(p,k))) return null;
 if (typeof p.v !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(p.v) || !['tablet','phone','pc'].includes(p.dev)) return null;
 if (!finite(p.fps,0,1000) || !finite(p.p1,0,1000) || p.p1 > p.fps * 1.02 || !finite(p.long33,0,1) || !finite(p.long50,0,1) || p.long50 > p.long33) return null;
 if (!Number.isInteger(p.q) || !finite(p.q,0,8) || !Number.isInteger(p.qmax) || !finite(p.qmax,p.q,8) || !finite(p.ratio,.5,2)) return null;
 if (!SCREEN_BUCKETS.includes(p.w) || !SCREEN_BUCKETS.includes(p.h) || !finite(p.dpr,.1,10) || !finite(p.sec,0,360)) return null;
 if (Math.abs(p.dpr * 100 - Math.round(p.dpr * 100)) > 1e-8) return null;
 return Object.fromEntries(fields.map(k => [k,p[k]]));
}
export function validateCause(c) {
 if (!object(c) || !small(c) || Object.keys(c).length !== 3) return null;
 if (typeof c.id !== 'string' || !/^[A-Za-z0-9_:-]{1,40}$/.test(c.id) || !['enemy','boss','hazard','shot'].includes(c.kind) || !finite(c.at,0,360)) return null;
 return {id:c.id,kind:c.kind,at:c.at};
}
