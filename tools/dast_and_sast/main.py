# main.py
import argparse
from sast_core.scanner import SastScanner
from dast_core.scanner import DastScanner
from report_generator.generator import generate_report

def main():
    parser = argparse.ArgumentParser(description="Professional Security Scanner")
    subparsers = parser.add_subparsers(dest='scan_type', required=True)

    # SAST Arguments
    sast_parser = subparsers.add_parser('sast', help='Static Application Security Testing')
    sast_parser.add_argument('-d', '--directory', required=True, help='Directory to scan')
    sast_parser.add_argument('-r', '--rules', default='config/sast_rules.yaml', help='SAST rules file')
    sast_parser.add_argument('-o', '--output', default='sast_report.html', help='Output report file')
    sast_parser.add_argument('-f', '--format', choices=['json', 'html'], default='html', help='Report format')

    # DAST Arguments
    dast_parser = subparsers.add_parser('dast', help='Dynamic Application Security Testing')
    dast_parser.add_argument('-u', '--url', required=True, help='Target URL to scan')
    dast_parser.add_argument('-p', '--payloads', default='config/dast_payloads.yaml', help='DAST payloads file')
    dast_parser.add_argument('-o', '--output', default='dast_report.html', help='Output report file')
    dast_parser.add_argument('-f', '--format', choices=['json', 'html'], default='html', help='Report format')

    args = parser.parse_args()

    if args.scan_type == 'sast':
        print("[*] Starting SAST Scan...")
        scanner = SastScanner(rules_file=args.rules)
        findings = scanner.scan_directory(args.directory)
        generate_report(findings, args.output, args.format)
        print("[*] SAST Scan Finished.")

    elif args.scan_type == 'dast':
        print("[*] Starting DAST Scan...")
        scanner = DastScanner(base_url=args.url, payloads_file=args.payloads)
        vulnerabilities = scanner.run_scan()
        generate_report(vulnerabilities, args.output, args.format)
        print("[*] DAST Scan Finished.")

if __name__ == '__main__':
    main()