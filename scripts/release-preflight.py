#!/usr/bin/env python3
"""Offline and non-destructive PawCare integration preflight.

Verifies source/package structure and flags release blockers without pretending that
static checks imply successful .NET, Oracle, web or Android execution.
Requires Python 3.10+, Node.js and globally/local accessible TypeScript for AST checks.
Run from any directory: python scripts/release-preflight.py [--strict]
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def record(name: str, status: str, detail: str, blocking: bool = False) -> dict:
    return {"check": name, "status": status, "detail": detail, "release_blocker": blocking}


def run(command: list[str]) -> tuple[int, str]:
    try:
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True,
                                encoding="utf-8", errors="replace", timeout=75)
        return result.returncode, (result.stdout + "\n" + result.stderr).strip()
    except (OSError, subprocess.TimeoutExpired) as error:
        return 127, f"Unable to run {command[0]}: {type(error).__name__}: {error}"


def source_audit_failure_detail(output: str) -> str:
    """Surface actual first-party failures instead of truncating a JSON report."""
    try:
        audit = json.loads(output)
        problems = audit.get('problems')
        if isinstance(problems, list) and problems:
            lines = [f'Static source audit reported {len(problems)} problem(s):']
            lines += [f'  - {problem}' for problem in problems[:15]]
            if len(problems) > 15:
                lines.append(f'  ... {len(problems) - 15} further problems; run python scripts/source-audit.py')
            return '\n'.join(lines)
    except (ValueError, TypeError, AttributeError):
        pass
    return output[-3000:] or 'Audit failed without diagnostic output.'


def inspect() -> dict:
    results: list[dict] = []
    migration_dir = ROOT / "database/oracle/migrations"
    migration_files = sorted(migration_dir.glob('V???_*.sql'))
    ddl = '\n'.join(file.read_text(encoding='utf-8') for file in migration_files)
    counts = {
        'migrations': len(migration_files),
        'tables': len(re.findall(r'\bCREATE\s+TABLE\b', ddl, re.I)),
        'foreign_keys': len(re.findall(r'\bFOREIGN\s+KEY\s*\(', ddl, re.I)),
        'explicit_indexes': len(re.findall(r'\bCREATE\s+(?:UNIQUE\s+)?INDEX\b', ddl, re.I)),
        'public_views': len(re.findall(r'\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b', ddl, re.I)),
    }
    expected = dict(migrations=13, tables=51, foreign_keys=100,
                    explicit_indexes=110, public_views=4)
    results.append(record('Oracle source object inventory', 'PASS' if counts == expected else 'FAIL',
                          f'Expected {expected}; observed {counts}', counts != expected))

    py = shutil.which('python') or sys.executable
    rc, output = run([py, str(ROOT/'scripts/source-audit.py')])
    results.append(record('Oracle SHA-256 + project static audit', 'PASS' if rc == 0 else 'FAIL',
                          'Existing audit passed' if rc == 0 else source_audit_failure_detail(output), rc != 0))

    node = shutil.which('node')
    if node:
        rc, output = run([node, str(ROOT/'scripts/validate-typescript.cjs')])
        results.append(record('Web/mobile TS syntax + local import audit', 'PASS' if rc == 0 else 'FAIL',
                              output[-1200:], rc != 0))
    else:
        results.append(record('Web/mobile TS syntax + local import audit', 'BLOCKED',
                              'Node.js not found; cannot run TypeScript source audit', True))

    source = ROOT / 'backend/PawCare.Api/Modules'
    folders = [x for x in source.iterdir() if x.is_dir() and x.name != 'Shared']
    endpoints = list(source.glob('*/**/*Endpoints.cs'))
    results.append(record('Feature modules and endpoint files',
                          'PASS' if len(folders)==22 and len(endpoints)==22 else 'FAIL',
                          f'{len(folders)} feature folders and {len(endpoints)} endpoint files',
                          len(folders)!=22 or len(endpoints)!=22))

    all_client_routes = len(list((ROOT/'frontend/app').rglob('page.tsx')))
    results.append(record('Web page inventory', 'PASS' if all_client_routes==41 else 'FAIL',
                          f'{all_client_routes} Next.js page.tsx routes; expected 41', all_client_routes!=41))

    for app in ('frontend','mobile'):
        package = ROOT/app/'package.json'
        lock = ROOT/app/'package-lock.json'
        results.append(record(f'{app} npm dependency lock', 'PASS' if lock.exists() else 'BLOCKED',
                              'package-lock.json available' if lock.exists() else
                              f'{app}/package-lock.json missing. Run npm.cmd install in {app}/ on a connected machine.',
                              not lock.exists()))

    dotnet = shutil.which('dotnet')
    if not dotnet:
        results.append(record('.NET 10 build/test runner', 'BLOCKED',
                              '.NET SDK is not installed in this environment. Run scripts/verify-windows.ps1 on a .NET 10 host.', True))
    else:
        rc, output = run([dotnet, '--version'])
        valid = rc == 0 and output.strip().startswith('10.')
        results.append(record('.NET 10 SDK available', 'PASS' if valid else 'BLOCKED',
                              f'dotnet --version: {output[:80]}', not valid))

    # No Oracle credential should be gathered automatically or copied to the audit report.
    results.append(record('Live Oracle migration/health/integration execution', 'NOT_RUN',
                          'Requires a separately authorized disposable Oracle PDB and integration-test opt-in.', True))
    results.append(record('Physical Android device, browser and deployment checks', 'NOT_RUN',
                          'Requires an Android device or EAS build, real browser and deployment environment.', True))
    # Source contains an email-token verification endpoint and a web callback.
    # SMTP is fail-closed by default, so a real delivery/activation test is a
    # separate release gate; its absence must not be described as missing code.
    auth_service = (ROOT/'backend/PawCare.Api/Modules/Auth/AuthService.cs').read_text(encoding='utf-8')
    auth_endpoints = (ROOT/'backend/PawCare.Api/Modules/Auth/AuthEndpoints.cs').read_text(encoding='utf-8')
    frontend_callback = ROOT/'frontend/app/api/v1/auth/verify-email/route.ts'
    has_verification = ('VerifyEmail' in auth_service and '/verify-email' in auth_endpoints
                        and frontend_callback.is_file())
    results.append(record('Self-service email verification source flow',
                          'PASS' if has_verification else 'FAIL',
                          'API verification endpoint and browser callback found; this does not prove SMTP delivery'
                          if has_verification else 'Verification source flow incomplete',
                          not has_verification))
    results.append(record('SMTP delivery and account activation E2E', 'NOT_RUN',
                          'SMTP is disabled by default; configure an authorized provider in staging and test registration, delivery, expiry and activation.', True))
    results.append(record('Live payment gateway', 'INCOMPLETE',
                          'PaymentGateway explicitly rejects checkout and webhooks until an approved provider and signed webhook verification are implemented.', True))

    return {'timestamp_utc': datetime.now(timezone.utc).isoformat(),
            'purpose': 'PawCare non-destructive static and environment preflight',
            'source_counts': counts,
            'checks': results,
            'release_ready': all(x['status']=='PASS' for x in results if x['release_blocker']),
            'note': 'PASS means only the named check passed; NOT_RUN/BLOCKED are never treated as PASS.'}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--strict', action='store_true', help='Exit nonzero when release blockers remain.')
    parser.add_argument('--output', type=Path, help='Write structured report to this JSON path.')
    args = parser.parse_args()
    data = inspect()
    for check in data['checks']:
        max_length = 3000 if check['status'] in ('FAIL', 'BLOCKED') else 150
        print(f"{check['status']:10} {check['check']}: {check['detail'][:max_length]}")
    print('Release-ready:', 'YES' if data['release_ready'] else 'NO')
    if args.output:
        path = args.output if args.output.is_absolute() else ROOT/args.output
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
        print('Report:', path)
    return 1 if args.strict and not data['release_ready'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
