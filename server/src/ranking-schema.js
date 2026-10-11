const USERS_COLUMNS={nickname:'TEXT',nickname_status:"TEXT NOT NULL DEFAULT 'none'",nickname_set_at:'INTEGER',nickname_note:'TEXT',title:'TEXT'};
const migrations=new WeakMap();
export function ensureRankingSchema(db){
  if(!migrations.has(db))migrations.set(db,apply(db).catch(e=>{migrations.delete(db);throw e;}));
  return migrations.get(db);
}
async function apply(db){
  for(const [table,columns] of [['users',USERS_COLUMNS],['play_runs',{flagged:'INTEGER NOT NULL DEFAULT 0'}]]){
    const present=new Set((await db.prepare(`PRAGMA table_info(${table})`).all()).results.map(r=>r.name));
    for(const [name,type] of Object.entries(columns))if(!present.has(name)){
      try{await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run();}
      catch(e){if(!String(e).includes('duplicate column'))throw e;}
    }
  }
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS play_settled ON play_runs(settled_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS play_flagged ON play_runs(flagged,settled_at)'),
  ]);
}
