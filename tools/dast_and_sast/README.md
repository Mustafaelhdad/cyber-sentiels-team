# SAST & DAST Security Scanner

Static Application Security Testing (SAST) and Dynamic Application Security Testing (DAST) tools for the Cyber Sentinels platform.

## Features

### SAST Scanner
- **Multi-language support**: PHP, JavaScript, TypeScript, Python
- **Regex-based detection**: Pattern matching for common vulnerabilities
- **Hybrid detection**: AST-based analysis for Python (more accurate SQL injection detection)
- **50+ security rules**: SQL Injection, XSS, Command Injection, Secrets, Weak Crypto, SSTI, etc.
- **Detailed findings**: File path, line number, code snippet, CWE reference, severity

### Output Format (JSON)
```json
{
  "scan_info": {
    "timestamp": "2025-12-20T12:00:00Z",
    "target_path": "/path/to/source",
    "total_findings": 5,
    "severity_counts": {"Critical": 1, "High": 2, "Medium": 2},
    "scan_duration_seconds": 1.23
  },
  "findings": [
    {
      "rule_id": "SAST002",
      "rule_name": "SQL Injection (Python F-String)",
      "description": "Using f-strings to build SQL queries can lead to SQL Injection...",
      "file_path": "/path/to/file.py",
      "line_number": 42,
      "severity": "High",
      "cwe": "CWE-89",
      "code_snippet": "cursor.execute(f\"SELECT * FROM users WHERE id = {user_id}\")",
      "language": "python"
    }
  ]
}
```

## Usage

### CLI Mode

```bash
# Scan a directory
python main.py sast -d /path/to/source -o report.json

# Scan with HTML output
python main.py sast -d /path/to/source -o report.html -f html

# Verbose mode
python main.py sast -d /path/to/source -o report.json -v

# Fail on Critical/High findings (for CI/CD)
python main.py sast -d /path/to/source -o report.json --fail-on-findings
```

### Python API

```python
from sast_core import SastScanner, Finding

# Create scanner
scanner = SastScanner(rules_file='config/sast_rules.yaml')

# Scan directory
findings = scanner.scan_directory('/path/to/source')

# Or get full result object
result = scanner.scan_to_result('/path/to/source')
print(f"Found {result.total_findings} issues in {result.scan_duration_seconds}s")

# Access findings
for finding in result.findings:
    print(f"{finding.severity}: {finding.rule_name} at {finding.file_path}:{finding.line_number}")
```

### Docker Container

```bash
# Build the container
docker build -t sentinel-sast ./tools/dast_and_sast

# Run API server
docker run -p 8080:8080 sentinel-sast

# Run CLI scan directly (mount source code)
docker run -v /path/to/source:/scan -v /path/to/output:/output \
    sentinel-sast python main.py sast -d /scan -o /output/report.json
```

### HTTP API (Docker)

```bash
# Health check
curl http://localhost:8080/health

# List rules
curl http://localhost:8080/rules

# Start scan (upload zip)
curl -X POST http://localhost:8080/scan \
    -F "source=@/path/to/source.zip" \
    -F "output_format=json"

# Check scan status
curl http://localhost:8080/scan/{scan_id}

# Download report
curl http://localhost:8080/scan/{scan_id}/report -o report.json

# List all scans
curl http://localhost:8080/scans
```

## Integration with Web App

The SAST service is integrated via Docker Compose:

```yaml
# docker-compose.yml
services:
  sast:
    build:
      context: ./tools/dast_and_sast
      dockerfile: Dockerfile
    container_name: sentinel_sast
    environment:
      - SAST_API_URL=http://sast:8080
    volumes:
      - sast_output:/app/output
      - reports_artifacts:/app/reports
```

### Laravel Backend Integration

```php
// Example: Trigger SAST scan from Laravel job
$response = Http::post('http://sast:8080/scan', [
    'source_path' => '/app/scans/project_123',
    'output_format' => 'json',
    'callback_url' => route('api.sast.callback', $scanId)
]);

$scanId = $response->json('scan_id');
```

## Rules Configuration

Rules are defined in `config/sast_rules.yaml`:

```yaml
rules:
  - id: SAST001
    name: "SQL Injection (PHP mysql_query)"
    description: "Direct usage of user-controlled superglobals..."
    pattern: 'mysql_query\s*\([^)]*\$_(GET|POST|REQUEST)\['
    severity: "Critical"
    language: "php"
    cwe: "CWE-89"
```

### Severity Levels
- **Critical**: Immediate exploitation risk (RCE, SQLi with direct user input)
- **High**: High-risk vulnerabilities requiring attention
- **Medium**: Moderate risk, should be reviewed
- **Low**: Informational or best practice violations
- **Info**: Informational findings

### Supported Vulnerability Categories
- SQL Injection (SQLi)
- Cross-Site Scripting (XSS)
- Command Injection
- Path Traversal / LFI
- Hardcoded Secrets & Credentials
- Weak Cryptography
- Insecure Deserialization
- Code Injection / Eval
- Server-Side Template Injection (SSTI)
- Information Disclosure
- Insecure Configuration
- Open Redirect
- SSRF

## Development

### Install Dependencies
```bash
cd tools/dast_and_sast
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```

### Run Tests
```bash
# Scan the vulnerable test app
python main.py sast -d . -o test_report.json -v

# Expected findings in vulnerable_flask_app.py:
# - SQL Injection (f-string in execute)
# - Debug mode enabled
```

### GUI Application
```bash
python gui_app.py
```

## File Structure

```
tools/dast_and_sast/
├── sast_core/
│   ├── __init__.py
│   ├── models.py          # Finding, ScanResult dataclasses
│   └── scanner.py         # Main SAST scanner engine
├── dast_core/             # DAST scanner (separate implementation)
├── report_generator/
│   ├── __init__.py
│   └── generator.py       # JSON/HTML report generation
├── config/
│   ├── sast_rules.yaml    # SAST vulnerability rules
│   └── dast_payloads.yaml # DAST attack payloads
├── main.py                # CLI entry point
├── api_server.py          # HTTP API server (Flask)
├── gui_app.py             # Desktop GUI (CustomTkinter)
├── Dockerfile             # Container definition
├── requirements.txt       # Python dependencies
└── vulnerable_flask_app.py # Test target application
```

---

## Task Summary

```
short_task_name: SAST Tool Multi-Language Scanner Implementation
estimated_hours_mid_level: 8
```

