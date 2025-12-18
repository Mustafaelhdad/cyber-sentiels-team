import requests
import socket
import time
import json

BASE = "http://127.0.0.1:5000"
TIMEOUT = 5.0

tests = []

# 1) GET root
tests.append({
    "name": "GET root",
    "method": "GET",
    "path": "/",
    "params": None,
    "json": None,
    "expect_block": False
})

xss_payloads = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "<iframe src='http://evil/'></iframe>",
    "<svg onload=alert(1)>",
    "<math><mi></mi></math>",
    "javascript:alert(1)",
    "onmouseover=alert(1)"
]
for p in xss_payloads:
    tests.append({"name": f"XSS query: {p}", "method": "GET", "path": "/", "params": {"q": p}, "json": None, "expect_block": True})
    tests.append({"name": f"XSS json.template: {p}", "method": "POST", "path": "/", "params": None, "json": {"template": p}, "expect_block": True})

sqli_payloads = [
    "1; DROP TABLE users;",
    "' OR 1=1 --",
    "'; exec xp_cmdshell('dir'); --",
    "UNION SELECT username, password FROM users",
    "SELECT * FROM users WHERE id=1"
]
for p in sqli_payloads:
    tests.append({"name": f"SQLi json.search: {p}", "method": "POST", "path": "/", "params": None, "json": {"search": p}, "expect_block": True})

os_payloads = [
    "; ls -la",
    "&& dir",
    "`whoami`",
    "$(whoami)"
]
for p in os_payloads:
    tests.append({"name": f"OS Command inj json: {p}", "method": "POST", "path": "/", "params": None, "json": {"cmd": p}, "expect_block": True})

# SSTI / template syntaxes
ssti_payloads = [
    "{{7*7}}", "{% 7*7 %}", "${7*7}", "<% 7*7 %>", "#{7*7}"
]
for p in ssti_payloads:
    tests.append({"name": f"SSTI json.template: {p}", "method": "POST", "path": "/", "params": None, "json": {"template": p}, "expect_block": True})

# NoSQL / LDAP / XPath heuristics
tests.append({"name": "NoSQL $where (as json)", "method": "POST", "path": "/", "params": None, "json": {"q": {"$where": "this.password=='x'"}}, "expect_block": True})
tests.append({"name": "NoSQL $regex", "method": "POST", "path": "/", "params": None, "json": {"q": {"$regex": "^a"}}, "expect_block": True})
tests.append({"name": "LDAP uid query", "method": "GET", "path": "/", "params": {"q": "(uid=admin)"}, "json": None, "expect_block": True})

# Email CRLF test (send-email)
tests.append({"name": "Email CRLF in to", "method": "POST", "path": "/send-email", "params": None, "json": {"to": "victim@example.com\nBCC:spam@bad.com", "subject": "s", "body": "x"}, "expect_block": True})

# Object / serialization heuristics
obj_payloads = [
    'O:8:"Exploit":0:{}',
    'a:1:{s:4:"name";s:100:"' + 'A'*100 + '";}',
    "pickle.loads(\"__import__('os').system('id')\")"
]
for p in obj_payloads:
    tests.append({"name": f"Object injection raw: {p}", "method": "POST", "path": "/", "params": None, "json": {"data": p}, "expect_block": True})

# Misc HTML/CSS injection
misc_payloads = [
    "<iframe src='http://evil'></iframe>",
    "<style>body{background:url('http://evil')}</style>",
    "<div onclick=alert(1)>click</div>"
]
for p in misc_payloads:
    tests.append({"name": f"HTML injection body: {p}", "method": "POST", "path": "/", "params": None, "json": {"body": p}, "expect_block": True})

def run_test(test):
    name = test["name"]
    method = test["method"]
    url = BASE + test["path"]
    try:
        if method == "GET":
            r = requests.get(url, params=test.get("params"), timeout=TIMEOUT)
        else:
            r = requests.post(url, json=test.get("json"), timeout=TIMEOUT)
        status = r.status_code
        ok = (status in (200, 201)) and (not test.get("expect_block"))
        blocked = (status in (403, 429)) and test.get("expect_block")
        if ok:
            print(f" PASS: {name} -> {status}")
        elif blocked:
            print(f" BLOCKED (expected): {name} -> {status}")
        else:
            print(f"  Unexpected result: {name} -> {status} | body: {r.text[:200]}")
        return status, r.text[:400]
    except Exception as e:
        print(f" ERROR: {name} -> {e}")
        return None, str(e)

# Raw socket Host CRLF test
def raw_host_crlf_test():
    try:
        raw_host = "127.0.0.1\r\nBad: injected"
        req_lines = [
            "GET / HTTP/1.1",
            f"Host: {raw_host}",
            "User-Agent: test-runner",
            "Connection: close",
            "",
            ""
        ]
        raw = "\r\n".join(req_lines).encode("utf-8")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3)
        sock.connect(("127.0.0.1", 5000))
        sock.sendall(raw)
        resp = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            resp += chunk
        sock.close()
        text = resp.decode("utf-8", errors="replace")
        return True, text[:400]
    except Exception as e:
        return False, str(e)

def main():
    print("Running full test suite against", BASE)
    time.sleep(0.5)
    summary = {"total": 0, "passed": 0, "blocked_expected": 0, "failed": 0}
    for t in tests:
        summary["total"] += 1
        status, _ = run_test(t)
        if status is None:
            summary["failed"] += 1
        elif (status in (200, 201)) and (not t.get("expect_block")):
            summary["passed"] += 1
        elif (status in (403, 429)) and t.get("expect_block"):
            summary["blocked_expected"] += 1
        else:
            summary["failed"] += 1
        time.sleep(0.12)

    ok, resp = raw_host_crlf_test()
    print("\nRaw Host CRLF socket test:", "Succeeded" if ok else "Failed", resp[:200])
    print("\nSummary:", summary)

if __name__ == "__main__":
    main()
