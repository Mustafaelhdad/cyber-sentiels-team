# report_generator/generator.py
"""
Report Generator for SAST/DAST scan findings.

Outputs findings in JSON or HTML format with proper sanitization and
detailed vulnerability information.
"""

import json
import os
from dataclasses import asdict
from datetime import datetime
from typing import List, Optional, Union

from html import escape as html_escape


def generate_report(
    findings: List,
    output_file: str,
    format: str = 'json',
    scan_metadata: Optional[dict] = None
) -> bool:
    """
    Generate a security scan report from findings.
    
    Args:
        findings: List of Finding objects or dictionaries
        output_file: Path to save the report
        format: Report format ('json' or 'html')
        scan_metadata: Optional metadata about the scan (target, duration, etc.)
    
    Returns:
        True if report was generated successfully, False otherwise
    """
    if not findings:
        print("[+] No findings to report.")
        # Still create empty report for consistency
        findings_dict = []
    else:
        # Convert findings to dictionaries if they're dataclass objects
        findings_dict = []
        for f in findings:
            if hasattr(f, 'to_dict'):
                findings_dict.append(f.to_dict())
            elif hasattr(f, '__dataclass_fields__'):
                findings_dict.append(asdict(f))
            elif isinstance(f, dict):
                findings_dict.append(f)
            else:
                # Fallback: try to extract known fields
                findings_dict.append({
                    'rule_id': getattr(f, 'rule_id', ''),
                    'rule_name': getattr(f, 'rule_name', getattr(f, 'name', '')),
                    'description': getattr(f, 'description', str(f)),
                    'file_path': getattr(f, 'file_path', ''),
                    'line_number': getattr(f, 'line_number', 0),
                    'severity': getattr(f, 'severity', 'Unknown'),
                    'cwe': getattr(f, 'cwe', ''),
                    'code_snippet': getattr(f, 'code_snippet', getattr(f, 'line_content', '')),
                    'language': getattr(f, 'language', '')
                })

    # Ensure output directory exists
    output_dir = os.path.dirname(output_file)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        if format.lower() == 'json':
            _generate_json_report(findings_dict, output_file, scan_metadata)
        elif format.lower() == 'html':
            _generate_html_report(findings_dict, output_file, scan_metadata)
        else:
            print(f"[-] Unknown format: {format}. Defaulting to JSON.")
            _generate_json_report(findings_dict, output_file, scan_metadata)
        
        print(f"[+] Report saved to {output_file}")
        return True
    except Exception as e:
        print(f"[-] Failed to generate report: {e}")
        return False


def _generate_json_report(
    findings: List[dict],
    output_file: str,
    scan_metadata: Optional[dict] = None
) -> None:
    """
    Generate a JSON report with detailed findings.
    
    Output schema:
    {
        "scan_info": {
            "timestamp": "ISO datetime",
            "target_path": "path scanned",
            "total_findings": N,
            "severity_counts": {...}
        },
        "findings": [
            {
                "rule_id": "SAST001",
                "rule_name": "SQL Injection",
                "description": "...",
                "file_path": "/path/to/file.php",
                "line_number": 42,
                "severity": "Critical",
                "cwe": "CWE-89",
                "code_snippet": "actual code line",
                "language": "php"
            },
            ...
        ]
    }
    """
    # Calculate severity counts
    severity_counts = {}
    for finding in findings:
        sev = finding.get('severity', 'Unknown')
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    report = {
        "scan_info": {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "target_path": scan_metadata.get('target_path', '') if scan_metadata else '',
            "total_findings": len(findings),
            "severity_counts": severity_counts,
            "scan_duration_seconds": scan_metadata.get('scan_duration_seconds', 0) if scan_metadata else 0
        },
        "findings": findings
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)


def _generate_html_report(
    findings: List[dict],
    output_file: str,
    scan_metadata: Optional[dict] = None
) -> None:
    """
    Generate an HTML report with styled vulnerability table.
    """
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    target_path = scan_metadata.get('target_path', 'N/A') if scan_metadata else 'N/A'
    
    # Calculate severity counts
    severity_counts = {}
    for finding in findings:
        sev = finding.get('severity', 'Unknown')
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    # Build severity badges
    severity_badges = ""
    for sev in ['Critical', 'High', 'Medium', 'Low', 'Info']:
        count = severity_counts.get(sev, 0)
        if count > 0:
            severity_badges += f'<span class="badge severity-{sev}">{sev}: {count}</span>'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAST Security Scan Report</title>
    <style>
        :root {{
            --bg-primary: #1a1a2e;
            --bg-secondary: #16213e;
            --bg-card: #0f3460;
            --text-primary: #eee;
            --text-secondary: #a0a0a0;
            --accent: #e94560;
            --critical: #ff2e63;
            --high: #ff6b35;
            --medium: #f9d923;
            --low: #4ecdc4;
            --info: #3b82f6;
        }}
        
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        
        header {{
            background: var(--bg-secondary);
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 20px;
            border-left: 4px solid var(--accent);
        }}
        
        h1 {{
            color: var(--accent);
            font-size: 2rem;
            margin-bottom: 10px;
        }}
        
        .meta {{
            color: var(--text-secondary);
            font-size: 0.9rem;
        }}
        
        .summary {{
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 20px;
        }}
        
        .stat-card {{
            background: var(--bg-card);
            padding: 20px 30px;
            border-radius: 8px;
            text-align: center;
            min-width: 150px;
        }}
        
        .stat-card .number {{
            font-size: 2.5rem;
            font-weight: bold;
            color: var(--accent);
        }}
        
        .stat-card .label {{
            color: var(--text-secondary);
            font-size: 0.85rem;
            text-transform: uppercase;
        }}
        
        .badges {{
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 20px;
        }}
        
        .badge {{
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
        }}
        
        .severity-Critical {{ background: var(--critical); color: white; }}
        .severity-High {{ background: var(--high); color: white; }}
        .severity-Medium {{ background: var(--medium); color: #333; }}
        .severity-Low {{ background: var(--low); color: #333; }}
        .severity-Info {{ background: var(--info); color: white; }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            background: var(--bg-secondary);
            border-radius: 10px;
            overflow: hidden;
        }}
        
        th, td {{
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid var(--bg-card);
        }}
        
        th {{
            background: var(--bg-card);
            color: var(--accent);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.8rem;
            letter-spacing: 0.5px;
        }}
        
        tr:hover {{
            background: rgba(233, 69, 96, 0.1);
        }}
        
        .severity-cell {{
            font-weight: 600;
            padding: 5px 10px;
            border-radius: 4px;
            display: inline-block;
            font-size: 0.8rem;
        }}
        
        .code-snippet {{
            font-family: 'Consolas', 'Monaco', monospace;
            background: var(--bg-primary);
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 0.85rem;
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }}
        
        .file-path {{
            color: var(--text-secondary);
            font-size: 0.85rem;
        }}
        
        .line-number {{
            color: var(--accent);
            font-weight: 600;
        }}
        
        .cwe-link {{
            color: var(--info);
            text-decoration: none;
        }}
        
        .cwe-link:hover {{
            text-decoration: underline;
        }}
        
        .empty-state {{
            text-align: center;
            padding: 60px 20px;
            background: var(--bg-secondary);
            border-radius: 10px;
            color: var(--text-secondary);
        }}
        
        .empty-state h2 {{
            color: var(--low);
            margin-bottom: 10px;
        }}
        
        footer {{
            text-align: center;
            padding: 20px;
            color: var(--text-secondary);
            font-size: 0.8rem;
            margin-top: 30px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🛡️ SAST Security Scan Report</h1>
            <p class="meta">
                <strong>Target:</strong> {html_escape(target_path)} | 
                <strong>Generated:</strong> {timestamp}
            </p>
        </header>
        
        <div class="summary">
            <div class="stat-card">
                <div class="number">{len(findings)}</div>
                <div class="label">Total Findings</div>
            </div>
            <div class="stat-card">
                <div class="number">{severity_counts.get('Critical', 0)}</div>
                <div class="label">Critical</div>
            </div>
            <div class="stat-card">
                <div class="number">{severity_counts.get('High', 0)}</div>
                <div class="label">High</div>
            </div>
            <div class="stat-card">
                <div class="number">{severity_counts.get('Medium', 0)}</div>
                <div class="label">Medium</div>
            </div>
        </div>
        
        <div class="badges">
            {severity_badges}
        </div>
"""

    if findings:
        html += """
        <table>
            <thead>
                <tr>
                    <th>Severity</th>
                    <th>Rule</th>
                    <th>File</th>
                    <th>Line</th>
                    <th>CWE</th>
                    <th>Code Snippet</th>
                </tr>
            </thead>
            <tbody>
"""
        for finding in findings:
            severity = finding.get('severity', 'Unknown')
            rule_id = html_escape(str(finding.get('rule_id', '')))
            rule_name = html_escape(str(finding.get('rule_name', '')))
            file_path = html_escape(str(finding.get('file_path', '')))
            line_number = finding.get('line_number', 0)
            cwe = html_escape(str(finding.get('cwe', '')))
            code_snippet = html_escape(str(finding.get('code_snippet', '')))[:100]
            
            # CWE link
            cwe_display = f'<a href="https://cwe.mitre.org/data/definitions/{cwe.replace("CWE-", "")}.html" target="_blank" class="cwe-link">{cwe}</a>' if cwe else '-'
            
            html += f"""
                <tr>
                    <td><span class="severity-cell severity-{severity}">{severity}</span></td>
                    <td><strong>{rule_id}</strong><br><small>{rule_name}</small></td>
                    <td class="file-path">{file_path}</td>
                    <td class="line-number">{line_number}</td>
                    <td>{cwe_display}</td>
                    <td><code class="code-snippet">{code_snippet}</code></td>
                </tr>
"""
        
        html += """
            </tbody>
        </table>
"""
    else:
        html += """
        <div class="empty-state">
            <h2>✅ No Vulnerabilities Found</h2>
            <p>The scan completed without finding any security issues.</p>
        </div>
"""

    html += """
        <footer>
            Generated by Cyber Sentinels SAST Scanner
        </footer>
    </div>
</body>
</html>
"""

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)


def generate_json_findings(findings: List, output_file: str) -> bool:
    """
    Shortcut to generate just the findings JSON without wrapper.
    Useful for API responses or worker output.
    """
    return generate_report(findings, output_file, format='json')
