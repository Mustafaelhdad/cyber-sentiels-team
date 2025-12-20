#!/usr/bin/env python3
"""
WAF Test Runner - Comprehensive testing for Flask WAF
Works with both local development and Docker deployment

Usage:
  # Test local Flask WAF
  python waf_test_runner.py --url http://127.0.0.1:5000

  # Test Docker deployment
  python waf_test_runner.py --url http://localhost/waf-flask

  # Test with proxy token
  python waf_test_runner.py --url http://localhost:5000 --token testtoken

  # Output JSON for frontend
  python waf_test_runner.py --url http://127.0.0.1:5000 --json --output results.json
"""

import argparse
import json
import requests
import time
import sys
from datetime import datetime
from typing import List, Dict, Any, Optional

# ============================================================================
# TEST CASES - Attack payloads and expected results
# ============================================================================

def get_test_cases() -> List[Dict[str, Any]]:
    """Generate all test cases for WAF testing."""
    tests = []

    # === CLEAN REQUESTS (should PASS) ===
    tests.append({
        "id": "clean-001",
        "name": "Clean GET request",
        "category": "Clean Traffic",
        "method": "GET",
        "path": "/",
        "params": None,
        "json_body": None,
        "expect_block": False,
        "description": "Basic clean request should pass through"
    })
    
    tests.append({
        "id": "clean-002",
        "name": "Clean GET with safe param",
        "category": "Clean Traffic",
        "method": "GET",
        "path": "/",
        "params": {"q": "hello world"},
        "json_body": None,
        "expect_block": False,
        "description": "Normal search query should pass"
    })

    tests.append({
        "id": "clean-003",
        "name": "Clean POST JSON",
        "category": "Clean Traffic",
        "method": "POST",
        "path": "/",
        "params": None,
        "json_body": {"name": "John Doe", "email": "john@example.com"},
        "expect_block": False,
        "description": "Normal JSON POST should pass"
    })

    # === XSS ATTACKS (should BLOCK) ===
    xss_payloads = [
        ("<script>alert(1)</script>", "Basic script tag"),
        ("<img src=x onerror=alert(1)>", "IMG onerror handler"),
        ("<svg onload=alert(1)>", "SVG onload handler"),
        ("<iframe src='javascript:alert(1)'></iframe>", "Iframe javascript"),
        ("javascript:alert(document.cookie)", "Javascript URI"),
        ("<div onmouseover=alert(1)>", "Event handler injection"),
    ]
    for i, (payload, desc) in enumerate(xss_payloads, 1):
        tests.append({
            "id": f"xss-{i:03d}",
            "name": f"XSS: {desc}",
            "category": "XSS / HTML Injection",
            "method": "GET",
            "path": "/",
            "params": {"q": payload},
            "json_body": None,
            "expect_block": True,
            "description": f"XSS attack: {desc}",
            "payload": payload
        })

    # === SQL INJECTION (should BLOCK) ===
    sqli_payloads = [
        ("' OR '1'='1", "Classic OR bypass"),
        ("1; DROP TABLE users;--", "DROP TABLE"),
        ("UNION SELECT username,password FROM users", "UNION SELECT"),
        ("' AND 1=1--", "AND condition"),
        ("admin'--", "Comment injection"),
        ("1' OR '1'='1' /*", "Comment bypass"),
    ]
    for i, (payload, desc) in enumerate(sqli_payloads, 1):
        tests.append({
            "id": f"sqli-{i:03d}",
            "name": f"SQLi: {desc}",
            "category": "SQL Injection",
            "method": "GET",
            "path": "/",
            "params": {"id": payload},
            "json_body": None,
            "expect_block": True,
            "description": f"SQL Injection: {desc}",
            "payload": payload
        })

    # === COMMAND INJECTION (should BLOCK) ===
    cmd_payloads = [
        ("; ls -la", "Semicolon command"),
        ("&& whoami", "AND command"),
        ("| cat /etc/passwd", "Pipe command"),
        ("`id`", "Backtick execution"),
        ("$(whoami)", "Subshell execution"),
    ]
    for i, (payload, desc) in enumerate(cmd_payloads, 1):
        tests.append({
            "id": f"cmd-{i:03d}",
            "name": f"Command Injection: {desc}",
            "category": "Command Injection",
            "method": "POST",
            "path": "/",
            "params": None,
            "json_body": {"input": payload},
            "expect_block": True,
            "description": f"OS Command Injection: {desc}",
            "payload": payload
        })

    # === SSTI (should BLOCK) ===
    ssti_payloads = [
        ("{{7*7}}", "Jinja2/Twig"),
        ("${7*7}", "Freemarker/Velocity"),
        ("#{7*7}", "Ruby ERB"),
        ("<%= 7*7 %>", "EJS/ERB"),
        ("{%25 set x = 7*7 %25}", "URL-encoded Jinja"),
    ]
    for i, (payload, desc) in enumerate(ssti_payloads, 1):
        tests.append({
            "id": f"ssti-{i:03d}",
            "name": f"SSTI: {desc}",
            "category": "Server-Side Template Injection",
            "method": "POST",
            "path": "/",
            "params": None,
            "json_body": {"template": payload},
            "expect_block": True,
            "description": f"SSTI attack: {desc}",
            "payload": payload
        })

    # === NOSQL INJECTION (should BLOCK) ===
    tests.append({
        "id": "nosql-001",
        "name": "NoSQL $where operator",
        "category": "NoSQL Injection",
        "method": "POST",
        "path": "/",
        "params": None,
        "json_body": {"query": {"$where": "this.password == 'x'"}},
        "expect_block": True,
        "description": "MongoDB $where injection",
        "payload": "$where"
    })
    
    tests.append({
        "id": "nosql-002",
        "name": "NoSQL $regex operator",
        "category": "NoSQL Injection",
        "method": "POST",
        "path": "/",
        "params": None,
        "json_body": {"query": {"$regex": "^admin"}},
        "expect_block": True,
        "description": "MongoDB $regex injection",
        "payload": "$regex"
    })

    # === CRLF / HEADER INJECTION (should BLOCK) ===
    tests.append({
        "id": "crlf-001",
        "name": "CRLF in parameter",
        "category": "CRLF Injection",
        "method": "GET",
        "path": "/",
        "params": {"redirect": "http://evil.com\r\nSet-Cookie: malicious=1"},
        "json_body": None,
        "expect_block": True,
        "description": "CRLF header injection attempt",
        "payload": "\\r\\n"
    })

    return tests


# ============================================================================
# TEST RUNNER
# ============================================================================

class WafTestRunner:
    """Run WAF tests and collect results."""

    def __init__(self, base_url: str, token: Optional[str] = None, timeout: float = 10.0):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.timeout = timeout
        self.results = []
        self.start_time = None
        self.end_time = None

    def _build_url(self, path: str) -> str:
        """Build full URL, optionally with proxy token."""
        if self.token:
            # Proxy mode: /waf/{token}/{path}
            return f"{self.base_url}/waf/{self.token}{path}"
        return f"{self.base_url}{path}"

    def run_test(self, test: Dict[str, Any]) -> Dict[str, Any]:
        """Run a single test case."""
        url = self._build_url(test["path"])
        method = test["method"]
        
        result = {
            "id": test["id"],
            "name": test["name"],
            "category": test["category"],
            "description": test.get("description", ""),
            "payload": test.get("payload", ""),
            "expect_block": test["expect_block"],
            "url": url,
            "method": method,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        try:
            start = time.time()
            
            if method == "GET":
                response = requests.get(
                    url,
                    params=test.get("params"),
                    timeout=self.timeout,
                    allow_redirects=False
                )
            else:
                headers = {"Content-Type": "application/json"} if test.get("json_body") else {}
                response = requests.post(
                    url,
                    params=test.get("params"),
                    json=test.get("json_body"),
                    headers=headers,
                    timeout=self.timeout,
                    allow_redirects=False
                )

            elapsed = time.time() - start
            
            result["status_code"] = response.status_code
            result["response_time_ms"] = round(elapsed * 1000, 2)
            result["response_body"] = response.text[:500]  # Truncate for display
            
            # Determine pass/fail
            is_blocked = response.status_code in (403, 429)
            
            if test["expect_block"] and is_blocked:
                result["result"] = "BLOCKED"
                result["passed"] = True
                result["message"] = "Attack correctly blocked"
            elif not test["expect_block"] and not is_blocked:
                result["result"] = "PASSED"
                result["passed"] = True
                result["message"] = "Clean request passed through"
            elif test["expect_block"] and not is_blocked:
                result["result"] = "MISSED"
                result["passed"] = False
                result["message"] = f"Attack NOT blocked (got {response.status_code})"
            else:
                result["result"] = "FALSE_POSITIVE"
                result["passed"] = False
                result["message"] = f"Clean request blocked (got {response.status_code})"

        except requests.exceptions.Timeout:
            result["result"] = "TIMEOUT"
            result["passed"] = False
            result["message"] = "Request timed out"
            result["status_code"] = None
        except requests.exceptions.ConnectionError as e:
            result["result"] = "ERROR"
            result["passed"] = False
            result["message"] = f"Connection failed: {str(e)[:100]}"
            result["status_code"] = None
        except Exception as e:
            result["result"] = "ERROR"
            result["passed"] = False
            result["message"] = f"Error: {str(e)[:100]}"
            result["status_code"] = None

        return result

    def run_all(self, tests: List[Dict[str, Any]], delay: float = 0.1) -> Dict[str, Any]:
        """Run all test cases and return summary."""
        self.start_time = datetime.utcnow()
        self.results = []

        print(f"\n{'='*60}")
        print(f"WAF Test Runner - {self.base_url}")
        if self.token:
            print(f"Proxy Token: {self.token}")
        print(f"{'='*60}\n")

        for i, test in enumerate(tests, 1):
            result = self.run_test(test)
            self.results.append(result)

            # Print progress
            icon = "✓" if result["passed"] else "✗"
            color_result = result["result"]
            print(f"[{i:3d}/{len(tests)}] {icon} {test['name'][:40]:<40} -> {color_result}")

            if delay > 0:
                time.sleep(delay)

        self.end_time = datetime.utcnow()
        return self.get_summary()

    def get_summary(self) -> Dict[str, Any]:
        """Generate test summary."""
        total = len(self.results)
        passed = sum(1 for r in self.results if r["passed"])
        failed = total - passed

        # Group by category
        by_category = {}
        for r in self.results:
            cat = r["category"]
            if cat not in by_category:
                by_category[cat] = {"total": 0, "passed": 0, "failed": 0}
            by_category[cat]["total"] += 1
            if r["passed"]:
                by_category[cat]["passed"] += 1
            else:
                by_category[cat]["failed"] += 1

        # Group by result type
        by_result = {}
        for r in self.results:
            res = r["result"]
            by_result[res] = by_result.get(res, 0) + 1

        return {
            "summary": {
                "total": total,
                "passed": passed,
                "failed": failed,
                "pass_rate": round((passed / total) * 100, 2) if total > 0 else 0,
                "start_time": self.start_time.isoformat() + "Z" if self.start_time else None,
                "end_time": self.end_time.isoformat() + "Z" if self.end_time else None,
                "duration_seconds": (self.end_time - self.start_time).total_seconds() if self.end_time and self.start_time else 0,
            },
            "by_category": by_category,
            "by_result": by_result,
            "base_url": self.base_url,
            "token": self.token,
            "results": self.results,
        }


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="WAF Test Runner")
    parser.add_argument("--url", default="http://127.0.0.1:5000", help="WAF base URL")
    parser.add_argument("--token", default=None, help="Proxy token for /waf/{token}/ routes")
    parser.add_argument("--timeout", type=float, default=10.0, help="Request timeout in seconds")
    parser.add_argument("--delay", type=float, default=0.1, help="Delay between tests in seconds")
    parser.add_argument("--json", action="store_true", help="Output JSON format")
    parser.add_argument("--output", default=None, help="Output file path")
    args = parser.parse_args()

    # Get test cases
    tests = get_test_cases()

    # Run tests
    runner = WafTestRunner(args.url, token=args.token, timeout=args.timeout)
    summary = runner.run_all(tests, delay=args.delay)

    # Print summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Total Tests:  {summary['summary']['total']}")
    print(f"Passed:       {summary['summary']['passed']}")
    print(f"Failed:       {summary['summary']['failed']}")
    print(f"Pass Rate:    {summary['summary']['pass_rate']}%")
    print(f"Duration:     {summary['summary']['duration_seconds']:.2f}s")
    
    print(f"\nBy Category:")
    for cat, stats in summary["by_category"].items():
        print(f"  {cat}: {stats['passed']}/{stats['total']} passed")

    print(f"\nBy Result Type:")
    for result_type, count in summary["by_result"].items():
        print(f"  {result_type}: {count}")

    # Output JSON if requested
    if args.json or args.output:
        json_output = json.dumps(summary, indent=2, ensure_ascii=False)
        
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(json_output)
            print(f"\nResults saved to: {args.output}")
        else:
            print(f"\n{json_output}")

    # Exit code based on failures
    sys.exit(0 if summary["summary"]["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
