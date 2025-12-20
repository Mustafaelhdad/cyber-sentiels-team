#!/usr/bin/env python3
# main.py
"""
SAST/DAST Security Scanner CLI

Command-line interface for running security scans. Designed to work both
as a standalone tool and as a backend worker invoked by the web application.

Usage:
    # SAST scan
    python main.py sast -d /path/to/source -o /path/to/output/findings.json

    # DAST scan (to be implemented later)
    python main.py dast -u http://target.com -o /path/to/output/report.json
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Add parent directory to path for imports when running as script
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sast_core.scanner import SastScanner
from sast_core.models import Finding, ScanResult
from report_generator.generator import generate_report


def run_sast_scan(args) -> int:
    """
    Execute a SAST scan and generate output.
    
    Returns:
        Exit code: 0 on success, 1 on error, 2 if findings found (for CI/CD)
    """
    print(f"[*] Starting SAST scan on: {args.directory}")
    
    # Resolve paths
    target_path = os.path.abspath(args.directory)
    rules_file = os.path.abspath(args.rules)
    output_file = os.path.abspath(args.output)
    
    # Validate target exists
    if not os.path.exists(target_path):
        print(f"[-] Error: Target path does not exist: {target_path}")
        return 1
    
    # Validate rules file exists
    if not os.path.exists(rules_file):
        print(f"[!] Warning: Rules file not found at {rules_file}, using default location")
        # Try default location relative to script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        rules_file = os.path.join(script_dir, 'config', 'sast_rules.yaml')
        if not os.path.exists(rules_file):
            print(f"[-] Error: Cannot find rules file")
            return 1
    
    # Create scanner
    try:
        scanner = SastScanner(rules_file=rules_file)
    except Exception as e:
        print(f"[-] Error initializing scanner: {e}")
        return 1
    
    # Define logger for verbose output
    def log_progress(msg: str):
        if args.verbose:
            print(f"    {msg}")
    
    # Run scan
    try:
        scan_result = scanner.scan_to_result(target_path, logger=log_progress)
        findings = scan_result.findings
    except Exception as e:
        print(f"[-] Error during scan: {e}")
        return 1
    
    print(f"[*] Scan complete. Found {len(findings)} potential vulnerabilities.")
    
    # Generate report
    scan_metadata = {
        'target_path': target_path,
        'scan_duration_seconds': scan_result.scan_duration_seconds
    }
    
    success = generate_report(
        findings=findings,
        output_file=output_file,
        format=args.format,
        scan_metadata=scan_metadata
    )
    
    if not success:
        print(f"[-] Failed to generate report")
        return 1
    
    # Print summary by severity
    severity_counts = {}
    for f in findings:
        sev = f.severity if hasattr(f, 'severity') else f.get('severity', 'Unknown')
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
    
    if severity_counts:
        print("\n[*] Findings by severity:")
        for sev in ['Critical', 'High', 'Medium', 'Low', 'Info']:
            count = severity_counts.get(sev, 0)
            if count > 0:
                print(f"    - {sev}: {count}")
    
    print(f"\n[+] Report saved to: {output_file}")
    
    # Return exit code based on findings (useful for CI/CD)
    if args.fail_on_findings and findings:
        critical_or_high = severity_counts.get('Critical', 0) + severity_counts.get('High', 0)
        if critical_or_high > 0:
            return 2
    
    return 0


def run_dast_scan(args) -> int:
    """
    Execute a DAST scan (placeholder for future implementation).
    """
    print("[!] DAST scanning is not yet fully implemented in this CLI.")
    print("[!] Please use the DAST core module directly or wait for the next update.")
    
    # Placeholder - will be implemented later
    try:
        from dast_core.scanner import DastScanner
        print(f"[*] Starting DAST scan on: {args.url}")
        scanner = DastScanner(base_url=args.url, payloads_file=args.payloads)
        vulnerabilities = scanner.run_scan()
        
        if vulnerabilities:
            generate_report(vulnerabilities, args.output, args.format)
            print(f"[+] Found {len(vulnerabilities)} vulnerabilities")
        else:
            print("[+] No vulnerabilities found")
        
        return 0
    except Exception as e:
        print(f"[-] DAST Error: {e}")
        return 1


def main():
    """Main entry point for the CLI."""
    parser = argparse.ArgumentParser(
        description="Cyber Sentinels Security Scanner - SAST & DAST",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Scan a directory for vulnerabilities
  python main.py sast -d ./my-project -o report.json

  # Scan with HTML output
  python main.py sast -d ./src -o report.html -f html

  # Verbose scan with custom rules
  python main.py sast -d ./app -r custom_rules.yaml -o findings.json -v
        """
    )
    
    subparsers = parser.add_subparsers(dest='scan_type', required=True)

    # ============ SAST Arguments ============
    sast_parser = subparsers.add_parser(
        'sast',
        help='Static Application Security Testing - analyze source code'
    )
    sast_parser.add_argument(
        '-d', '--directory',
        required=True,
        help='Directory or file path to scan'
    )
    sast_parser.add_argument(
        '-r', '--rules',
        default='config/sast_rules.yaml',
        help='Path to SAST rules YAML file (default: config/sast_rules.yaml)'
    )
    sast_parser.add_argument(
        '-o', '--output',
        default='sast_report.json',
        help='Output report file path (default: sast_report.json)'
    )
    sast_parser.add_argument(
        '-f', '--format',
        choices=['json', 'html'],
        default='json',
        help='Report format (default: json)'
    )
    sast_parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose output (show each file being scanned)'
    )
    sast_parser.add_argument(
        '--fail-on-findings',
        action='store_true',
        help='Exit with code 2 if Critical/High findings are found (useful for CI/CD)'
    )

    # ============ DAST Arguments ============
    dast_parser = subparsers.add_parser(
        'dast',
        help='Dynamic Application Security Testing - test running applications'
    )
    dast_parser.add_argument(
        '-u', '--url',
        required=True,
        help='Target URL to scan (e.g., http://localhost:8000)'
    )
    dast_parser.add_argument(
        '-p', '--payloads',
        default='config/dast_payloads.yaml',
        help='Path to DAST payloads YAML file'
    )
    dast_parser.add_argument(
        '-o', '--output',
        default='dast_report.json',
        help='Output report file path'
    )
    dast_parser.add_argument(
        '-f', '--format',
        choices=['json', 'html'],
        default='json',
        help='Report format (default: json)'
    )

    args = parser.parse_args()

    if args.scan_type == 'sast':
        exit_code = run_sast_scan(args)
    elif args.scan_type == 'dast':
        exit_code = run_dast_scan(args)
    else:
        parser.print_help()
        exit_code = 1

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
