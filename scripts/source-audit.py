#!/usr/bin/env python3
"""Non-destructive static audit for the assembled PawCare project.
Does not connect to Oracle, install dependencies, or certify compilation.
"""
import hashlib, json, os, re, sys, shutil, subprocess, xml.etree.ElementTree as ET
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

# Generated directories are not first-party source and may intentionally contain
# fixture JSON or transient/incomplete build artifacts. Prune before descending;
# this also keeps local audits fast after npm and .NET builds.
GENERATED_DIR_NAMES = {
    'node_modules', '.next', '.expo', '.git', '.turbo', '.cache',
    'bin', 'obj', 'testresults', 'dist', 'coverage', '.gradle',
    'dist-audit-android',
}

def first_party_files():
    for directory, subdirectories, files in os.walk(ROOT):
        subdirectories[:] = [name for name in subdirectories
                             if name.lower() not in GENERATED_DIR_NAMES]
        for name in files:
            yield Path(directory) / name

problems=[]
checks={}

def verify(cond,msg):
    if not cond: problems.append(msg)
    return cond

# File naming is versioned V001_core_care.sql through V013_auth_verification.sql.
scripts=sorted((ROOT/'database/oracle/migrations').glob('V???_*.sql'))
checks['oracle_migrations']=len(scripts)
verify(len(scripts)==13,'Oracle V001-V013 migration count mismatch')
for n,script in enumerate(scripts,1):
    v=f'V{n:03}'
    verify(script.name.startswith(v+'_'),f'Missing migration {v}')
    source=script.read_text(encoding='utf8').replace('\r\n','\n').replace('\r','\n')
    begin=f'-- BEGIN {v} DDL (checksum scope starts after this line)'
    end=f'-- END {v} DDL (checksum scope ends before this line)'
    if begin not in source or end not in source:
        problems.append(f'{v}: missing SHA256 scope markers');continue
    ddl=source.split(begin,1)[1].split('\n',1)[1].split(end,1)[0]
    h=hashlib.sha256(ddl.encode('utf8')).hexdigest()
    # V013 includes an explicit applied_at=SYSTIMESTAMP value; older versions
    # let Oracle use the column default. Verify both without weakening SHA-256.
    found=re.findall(r"\(\s*'"+v+r"'\s*,\s*'[^']+'\s*,\s*'ORACLE'\s*,\s*'([0-9a-f]{64})'\s*(?:,\s*SYSTIMESTAMP\s*)?\)",source,re.I|re.S)
    verify(len(found)==1 and found[0].lower()==h,f'{v}: checksum does not match declared migration checksum')

checks['oracle_bootstrap']=verify((ROOT/'database/oracle/000_create_schema.sql').is_file(),'Oracle bootstrap missing')
checks['oracle_seed_scripts']=len(list((ROOT/'database/oracle/seeds').glob('*.sql')))
checks['oracle_verification_scripts']=len(list((ROOT/'database/oracle/verification').glob('*.sql')))
checks['sqlite_directory_absent']=verify(not (ROOT/'database/sqlite').exists(),'SQLite directory present despite Oracle-only decision')
for pkg in [ROOT/'backend/PawCare.Api/PawCare.Api.csproj',ROOT/'backend/PawCare.Api.Tests/PawCare.Api.Tests.csproj',ROOT/'backend/PawCare.IntegrationTests/PawCare.IntegrationTests.csproj']:
    try:
        xml=ET.parse(pkg).getroot()
        verify(any(e.text=='net10.0' for e in xml.iter('TargetFramework')),str(pkg)+': target mismatch')
    except Exception as e:problems.append(f'CSProj invalid {pkg}: {e}')
for p in first_party_files():
    if p.suffix.lower() != '.json': continue
    if p.name == 'STATIC_CHECKS.json': continue  # This report is written while the audit runs.
    try:json.loads(p.read_text(encoding='utf8'))
    except Exception as e:problems.append(f'Invalid JSON {p.relative_to(ROOT)}: {e}')
try:
    import yaml
    for p in list((ROOT/'.github').rglob('*.yml'))+list((ROOT/'.github').rglob('*.yaml')):
        yaml.safe_load(p.read_text())
except ImportError:
    pass
except Exception as e:
    problems.append(f'Workflow YAML parse error {e}')
program=(ROOT/'backend/PawCare.Api/Program.cs').read_text()
for phrase in ['AddPawCareServices(', 'AddPawCareSecurity()', 'AddPawCareFeatureModules()',
               'MapPawCareFeatureModules()', 'UseMiddleware<RequestIdMiddleware>()',
               'UseMiddleware<ErrorHandler>()', 'UseMiddleware<AuditMiddleware>()',
               'AddHostedService<ReminderWorker>()', 'AddHostedService<OutboxWorker>()',
               'AddHostedService<InventoryReconcileWorker>()']:
    verify(program.count(phrase)==1,'Program.cs missing/duplicate registration: '+phrase)
verify('app.UseExceptionHandler(' not in program,'Conflicting inline exception handler')
checks['backend_feature_modules']=len([p for p in (ROOT/'backend/PawCare.Api/Modules').iterdir() if p.is_dir() and p.name!='Shared'])
verify(checks['backend_feature_modules']==22,'Expected 22 feature modules')
# Catch multiline C# raw strings with inline delimiters, which caused CS8997/CS9000.
# This is not a replacement for a real dotnet build.
raw_string_issues=[]
for source_file in (ROOT/'backend/PawCare.Api/Modules').rglob('*.cs'):
    source_text=source_file.read_text(encoding='utf8')
    for match in re.finditer(r'"""(.*?)"""',source_text,re.DOTALL):
        payload=match.group(1)
        if '\n' in payload and (payload.split('\n',1)[0].strip() or payload.rsplit('\n',1)[-1].strip()):
            raw_string_issues.append(str(source_file.relative_to(ROOT)))
checks['invalid_csharp_multiline_raw_literals']=len(raw_string_issues)
verify(not raw_string_issues,'Invalid multiline C# raw literals: '+', '.join(sorted(set(raw_string_issues))))
checks['backend_csharp_files']=sum(1 for p in first_party_files() if p.suffix.lower()=='.cs' and 'backend' in p.relative_to(ROOT).parts)
checks['frontend_page_routes']=len(list((ROOT/'frontend/app').rglob('page.tsx')))
verify(checks['frontend_page_routes']==41,'Expected 41 frontend pages')
checks['mobile_screen_files']=len(list((ROOT/'mobile/src/screens').rglob('*Screen.tsx')))
verify(checks['mobile_screen_files']>=41,'Expected at least 41 mobile screens')
checks['frontend_package_lock']= (ROOT/'frontend/package-lock.json').is_file()
checks['mobile_package_lock']= (ROOT/'mobile/package-lock.json').is_file()
sdk_command=shutil.which('dotnet')
checks['sdk_available_locally']=False
checks['sdk_version']=None
if sdk_command:
    try:
        sdk_process=subprocess.run([sdk_command,'--version'],capture_output=True,text=True,timeout=5)
        if sdk_process.returncode==0:
            checks['sdk_version']=sdk_process.stdout.strip()
            checks['sdk_available_locally']=checks['sdk_version'].startswith('10.')
    except (OSError,subprocess.SubprocessError):
        pass
checks['all_files']=sum(1 for _ in first_party_files())
checks['problems']=problems
print(json.dumps(checks,indent=2))
sys.exit(1 if problems else 0)
