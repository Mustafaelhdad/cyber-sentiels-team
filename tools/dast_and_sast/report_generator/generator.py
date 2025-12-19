# report_generator/generator.py
import json
from dataclasses import asdict

def generate_report(findings, output_file, format='json'):
    if not findings:
        print("[+] No findings to report.")
        return

   
    findings_dict = [asdict(f) for f in findings]
    
    if format == 'json':
        with open(output_file, 'w') as f:
            json.dump(findings_dict, f, indent=4)
        print(f"[+] Report saved to {output_file}")
    
    elif format == 'html':
        html = _generate_html(findings_dict)
        with open(output_file, 'w') as f:
            f.write(html)
        print(f"[+] Report saved to {output_file}")

def _generate_html(findings):
    if not findings:
        return "<h1>No vulnerabilities found.</h1>"
    
    headers = findings[0].keys()
    html = """
    <html>
    <head>
        <title>Security Scan Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .severity-Critical { color: red; font-weight: bold; }
            .severity-High { color: orange; }
            .severity-Medium { color: #DBA800; }
        </style>
    </head>
    <body>
        <h1>Security Scan Report</h1>
        <table>
            <tr>"""
    for header in headers:
        html += f"<th>{header.replace('_', ' ').title()}</th>"
    html += "</tr>"

    for item in findings:
        html += "<tr>"
        for header in headers:
            value = str(item.get(header, ''))
            if header == 'severity':
                html += f'<td class="severity-{value}">{value}</td>'
            else:
                 # Escape HTML to prevent self-XSS in report :)
                html += f'<td>{value.replace("<", "&lt;").replace(">", "&gt;")}</td>'
        html += "</tr>"
    
    html += """
        </table>
    </body>
    </html>
    """
    return html