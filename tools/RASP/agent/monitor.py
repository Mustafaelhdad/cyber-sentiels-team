# agent/monitor.py
"""
RASPMonitor - Enhanced
-----------------------
Real-time inspection for incoming HTTP requests inside a Flask app.
Now includes:
- Severity classification
- Caching
- Ignored headers/params list
- Rich context info (IP, Method, UA)
- Improved async reporting via ThreadPoolExecutor
"""

from flask import request
from typing import List, Optional, Dict, Any
import requests
import threading
from concurrent.futures import ThreadPoolExecutor
from .detector import default_detectors, Detector
from .utils import now_ts, make_id, log_incident

DEFAULT_API_ENDPOINT = "http://127.0.0.1:9000/rasp/notify"

IGNORED_HEADERS = {"accept", "accept-encoding", "accept-language", "connection", "content-length", "content-type", "host"}
IGNORED_PARAMS = {"csrf_token", "auth_token", "sessionid"}

SEVERITY_MAP = {
    "xss": "high",
    "sqli": "critical",
    "os_cmd_injection": "critical",
    "rfi_ssrf": "high",
    "lfi": "high",
    "xxe": "high",
    "xpath_injection": "medium",
    "ldap_injection": "medium",
    "crlf_injection": "medium",
    "open_redirect": "medium",
    "file_upload_abuse": "high",
    "insecure_deserialization": "critical",
    "obfuscation": "low",
    "suspicious_blob": "low",
}

class RASPMonitor:
    def __init__(self,
                 detectors: Optional[List[Detector]] = None,
                 api_endpoint: Optional[str] = None,
                 send_to_api: bool = True,
                 agent_name: str = "student-rasp"):
        self.detectors = detectors or default_detectors()
        self.api_endpoint = api_endpoint or DEFAULT_API_ENDPOINT
        self.send_to_api = send_to_api
        self.agent_name = agent_name
        self.counters: Dict[tuple, int] = {}
        self.cache: Dict[str, List[str]] = {}
        self.executor = ThreadPoolExecutor(max_workers=5)

    def _run_detectors(self, value: str) -> List[str]:
        if not value:
            return []
        if value in self.cache:
            return self.cache[value]

        tags = []
        for d in self.detectors:
            found = d.detect(value)
            if found:
                tags.extend(found)

        if tags:
            self.cache[value] = tags
        return tags

    def _report_incident(self, incident: Dict[str, Any]):
        log_incident(incident)
        if self.send_to_api and self.api_endpoint:
            self.executor.submit(self._send_to_api, incident)

    def _send_to_api(self, incident: Dict[str, Any]):
        try:
            requests.post(self.api_endpoint, json=incident, timeout=2)
        except Exception:
            pass 

    def _make_incident(self, path, source_type, key, value, finding_type):
        self.counters.setdefault((path, finding_type), 0)
        self.counters[(path, finding_type)] += 1
        occ = self.counters[(path, finding_type)]

        severity = SEVERITY_MAP.get(finding_type, "low")
        client_ip = request.remote_addr or "unknown"
        method = request.method
        user_agent = request.headers.get("User-Agent", "unknown")

        incident = {
            "id": make_id(),
            "agent": self.agent_name,
            "ts": now_ts(),
            "path": path,
            "method": method,
            "source": source_type,
            "param": key,
            "value_snippet": (value[:300] + "...") if len(value) > 300 else value,
            "finding_type": finding_type,
            "severity": severity,
            "occurrence": occ,
            "client_ip": client_ip,
            "user_agent": user_agent,
        }
        return incident

    def inspect_request(self, path: Optional[str] = None):
        incidents = []
        try:
            path = path or request.path
            # query params
            for k, v in request.args.items():
                if k.lower() in IGNORED_PARAMS:
                    continue
                tags = self._run_detectors(v)
                for t in tags:
                    inc = self._make_incident(path, "query", k, v, t)
                    incidents.append(inc)
                    self._report_incident(inc)

            # form data
            for k, v in request.form.items():
                if k.lower() in IGNORED_PARAMS:
                    continue
                tags = self._run_detectors(v)
                for t in tags:
                    inc = self._make_incident(path, "form", k, v, t)
                    incidents.append(inc)
                    self._report_incident(inc)

            # JSON body
            if request.is_json:
                data = request.get_json(silent=True) or {}
                if isinstance(data, dict):
                    for k, v in data.items():
                        sval = v if isinstance(v, str) else str(v)
                        tags = self._run_detectors(sval)
                        for t in tags:
                            inc = self._make_incident(path, "json", k, sval, t)
                            incidents.append(inc)
                            self._report_incident(inc)

            # headers
            for k, v in request.headers.items():
                if k.lower() in IGNORED_HEADERS:
                    continue
                if len(v) > 1000:
                    continue
                tags = self._run_detectors(v)
                for t in tags:
                    inc = self._make_incident(path, "header", k, v, t)
                    incidents.append(inc)
                    self._report_incident(inc)

        except RuntimeError:
            pass
        return incidents

    def attach_to_flask(self, app):
        """Attach monitor to Flask app."""
        @app.before_request
        def _before():
            self.inspect_request()
