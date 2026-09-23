"""Build a reviewable v2 source archive; never deploy or modify historic share files."""
from __future__ import annotations
import argparse, hashlib, json, re, shutil, zipfile
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parent.parent)
parser.add_argument('--output', type=Path)
args = parser.parse_args()
root = args.project.resolve()
output = (args.output or root.parent.parent / 'outputs' / '서호팡팡수호대_5원소_구현_v2.0').resolve()
output.mkdir(parents=True, exist_ok=True)
qa = root / 'work/v2-qa'
qa.mkdir(parents=True, exist_ok=True)
now = datetime.now(timezone.utc).isoformat()
sha = lambda blob: hashlib.sha256(blob).hexdigest()
def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Generate the resource ledger from exact current bytes, preserving earlier provenance.
old_manifest = json.loads((root / 'resource-manifest.json').read_text(encoding='utf-8-sig'))
origins = {f['path']: f.get('origin', 'preserved_existing') for f in old_manifest.get('files', [])}
assets = []
for source in sorted((root / 'game/assets').rglob('*')):
    if not source.is_file(): continue
    rel = source.relative_to(root).as_posix()
    origin = ('generated_imagegen_v2' if source.suffix.lower() == '.png' else 'generated_svg_v2') if '/elements_v2/' in rel else origins.get(rel, 'preserved_existing')
    blob = source.read_bytes()
    assets.append({'path': rel, 'bytes': len(blob), 'sha256': sha(blob), 'origin': origin})
manifest = {'date': now[:10], 'release': 'guardian-v2-20260922', 'verifiedAt': now, 'fileCount': len(assets), 'files': assets}
write_json(root / 'resource-manifest.json', manifest)
write_json(output / 'resource-manifest.json', manifest)

# Documentation is authored by the UI/documentation task, then copied without altering historic share entries.
new_readme = output / 'README.md'
if not new_readme.exists():
    raise SystemExit('Waiting for final output README.md from the documentation task.')
archive_docs = root / 'docs/archive'
archive_docs.mkdir(parents=True, exist_ok=True)
previous_readme = root / 'README.md'
if previous_readme.exists() and not (archive_docs / 'README-before-v2.md').exists():
    shutil.copyfile(previous_readme, archive_docs / 'README-before-v2.md')
for name in ['README.md', '파일별_변경내역.md', '리소스_목록.md', '리소스_검증목록.json']:
    source = output / name
    if source.exists():
        destination = root / 'docs' / ('GUARDIAN_V2_HANDOFF.md' if name == 'README.md' else name)
        shutil.copyfile(source, destination)
(root / 'README.md').write_text('''# 서호팡팡수호대 · 5원소 전투 v2

현재 구현은 환경 테마 **1-1~1-5**입니다. 2~6챕터 확장 계획은 아직 구현하지 않았습니다.

- [v2 인수인계와 검증 범위](docs/GUARDIAN_V2_HANDOFF.md)
- [파일별 변경 내역](docs/파일별_변경내역.md)
- [리소스 목록](docs/리소스_목록.md)
- [전체 리소스 SHA-256 목록](resource-manifest.json)
- [공개 인수인계 문서](share/guardian-rework-v2.md)

주요 구현: `game/src/element-content.js`는 스킬·파츠·합성 데이터, `rework-core.js`는 공통 성장 규칙,
`element-combat.js`와 `weapon-effects.js`는 실제 전투, `rework-ui.js`는 로비 화면입니다.
`server/src/guardian.js`는 보상·이용권·요청 중복 처리, `profile-migration-v2.js`는 기존 자산 이전을 담당합니다.

검증: Node.js 24에서 `npm test`. 빌드: `npm run build`.
서버 의존성: `cd server` 뒤 `npm ci`. `server/wrangler.toml`의 대상 계정·D1을 확인한 뒤 사용하세요.
로컬 테스트용 관리자 열쇠와 `LOCAL_TEST_CLOCK`은 로컬 `.dev.vars`에만 설정하며,
운영 관리자 열쇠는 기존 Worker secret을 유지합니다. 이 압축본에 비밀값이나 학생 DB는 없습니다.

역사적 v1 문서·데이터는 이전 근거로 보관되어 있습니다. 최신 기준은 위 v2 인수인계와 코드입니다.
압축본에서 제외한 과거 공개 ZIP·큰 미리보기는 운영 소스의 `share/`에서 보존해야 합니다.
압축본만으로 기존 배포의 모든 과거 공개 자료를 재구성할 수는 없습니다.
''', encoding='utf-8')
shutil.copyfile(root / 'docs/GUARDIAN_V2_HANDOFF.md', root / 'share/guardian-rework-v2.md')

# Build a strict allowlist. Runtime caches, credentials, databases and nested release archives are never candidates.
selected = {}
for folder in ['game', 'server/src', 'server/migrations', 'tests', 'tools', 'data', 'docs']:
    for source in sorted((root / folder).rglob('*')):
        if source.is_file(): selected[source.relative_to(root).as_posix()] = source
for name in ['package.json', 'package-lock.json', 'README.md', 'HANDOFF.md', 'resource-manifest.json', 'asset_list.md', 'server/package.json', 'server/package-lock.json', 'server/wrangler.toml', 'server/schema.sql', 'server/README.md', 'share/index.html']:
    source = root / name
    if source.is_file(): selected[name] = source
for source in sorted((root / 'share').rglob('*')):
    if source.is_file() and (source.suffix.lower() in {'.md', '.json', '.csv', '.txt', '.svg'} or (source.is_relative_to(root / 'share/server') and source.suffix.lower() in {'.js', '.toml', '.sql', '.html', '.ps1'})):
        selected[source.relative_to(root).as_posix()] = source
for name in ['http-integration.json', 'http-integration.txt', 'unit-tests.txt', 'browser-results.json', 'balance-results.json', 'weapon-regression.json', 'hero-preservation.json']:
    source = qa / name
    if source.is_file(): selected['verification/' + name] = source
for source in sorted((output / 'screenshots').glob('*')):
    if source.is_file(): selected['docs/screenshots/' + source.name] = source
if (output / '검증_요약.json').exists(): selected['verification/검증_요약.json'] = output / '검증_요약.json'
selected['tools/package-v2.py'] = Path(__file__).resolve()
blocked_names = {'node_modules', '.wrangler', '.dev.vars', '.env', '.git', 'dist_web', 'credentials', 'secrets', 'default.toml'}
for rel in selected:
    if any(p.lower() in blocked_names or p.lower().startswith('.env.') for p in Path(rel).parts):
        raise SystemExit('Forbidden archive entry: ' + rel)
    if Path(rel).suffix.lower() in {'.zip', '.sqlite', '.db', '.pem', '.key'}:
        raise SystemExit('Forbidden archive file: ' + rel)

# Snapshot bytes once, then prove none of the inputs changed while compressing.
blobs = {rel: source.read_bytes() for rel, source in selected.items()}
for rel, blob in blobs.items():
    if Path(rel).suffix.lower() not in {'.js', '.mjs', '.json', '.toml', '.md', '.html', '.py', '.txt', '.csv'}: continue
    content = blob.decode('utf-8-sig', errors='replace')
    if re.search(r'seoho-(?=[a-z0-9]{0,7}[0-9])[a-z0-9]{8}(?![a-z0-9-])', content) or re.search(r'(?i)(oauth_token|refresh_token)\s*=\s*["\'][^"\']{16,}', content):
        raise SystemExit('Potential private credential detected in ' + rel + '; content withheld.')
receipt = {'release': 'guardian-v2-20260922', 'createdAt': now, 'scope': 'Stages CH01-CH05, source plus required assets; historical public archives excluded', 'files': [{'path': rel, 'bytes': len(blob), 'sha256': sha(blob)} for rel, blob in sorted(blobs.items())]}
blobs['SOURCE_MANIFEST.json'] = (json.dumps(receipt, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
notice = 'This source archive excludes node_modules, .wrangler, .dev.vars, private credentials, databases, dist_web, old public ZIP archives and large historical previews.\nRetain the existing project share/ files when updating a live deployment. Run npm run build before deployment.\n'
blobs['PACKAGING_NOTICE.txt'] = notice.encode('utf-8')
zip_path = output / 'seoho-guardian-rework-v2.zip'
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for rel, blob in sorted(blobs.items()): archive.writestr(rel, blob)
changed = [rel for rel, source in selected.items() if sha(source.read_bytes()) != sha(blobs[rel])]
if changed: raise SystemExit('Sources changed during packaging; rerun: ' + ', '.join(changed))
with zipfile.ZipFile(zip_path) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(set(archive.namelist())) == len(blobs)
    for rel, blob in blobs.items():
        assert sha(archive.read(rel)) == sha(blob), rel
size = zip_path.stat().st_size
if size > 25 * 1024 * 1024: raise SystemExit(f'Archive too large: {size} bytes')
shutil.copyfile(zip_path, root / 'share' / zip_path.name)
report = {'ok': True, 'createdAt': now, 'archive': str(zip_path), 'bytes': size, 'maxBytes': 25 * 1024 * 1024, 'sha256': sha(zip_path.read_bytes()), 'entries': len(blobs), 'assetCount': len(assets), 'historicShareFilesModifiedByPackager': False, 'containsPrivateRuntimeFiles': False, 'sourceSnapshotUnchangedDuringCompression': True}
write_json(output / 'source-package-verification.json', report)
write_json(qa / 'source-package-verification.json', report)
print(json.dumps(report, ensure_ascii=False, indent=2))




