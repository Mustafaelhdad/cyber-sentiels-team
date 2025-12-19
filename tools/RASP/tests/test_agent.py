# tests/test_agent.py
import pytest
from agent.detector import default_detectors
from agent.monitor import RASPMonitor

def test_detectors_basic():
    dets = default_detectors()
    # xss
    assert any(d.detect("<script>alert(1)</script>") for d in dets)
    # sqli
    assert any(d.detect("1 OR 1=1 --") for d in dets)
    # cmd
    assert any(d.detect("ls; rm -rf /tmp/test") for d in dets)

def test_monitor_inspect_simulated_request(monkeypatch):
    """
    Simulate a minimal Flask 'request' object with attributes the monitor expects:
    - path, args (mapping), form (mapping), headers (mapping with .get/.items),
      is_json, get_json(), remote_addr, method
    """
    class DummyHeaders(dict):
        def get(self, k, default=None):
            return super().get(k, default)
        def items(self):
            return super().items()

    class DummyReq:
        def __init__(self):
            self.path = "/test"
            self.args = {"q": "<script>alert(1)</script>"}
            self.form = {}
            self._headers = DummyHeaders({
                "User-Agent": "pytest-agent/1.0"
            })
            self.is_json = False
            self.remote_addr = "127.0.0.1"
            self.method = "POST"
        @property
        def headers(self):
            return self._headers
        def get_json(self, silent=True):
            return None

    # monkeypatch flask.request inside agent.monitor module to our dummy instance
    import agent.monitor as monitor_mod
    dummy = DummyReq()
    monkeypatch.setattr(monitor_mod, "request", dummy)

    m = RASPMonitor(send_to_api=False)
    incidents = m.inspect_request()
    assert len(incidents) >= 1, "Expected at least one incident from the dummy request"
    inc = incidents[0]
    assert inc["finding_type"] == "xss"
    assert "severity" in inc
    assert "client_ip" in inc or "remote_addr" in inc
    assert inc.get("client_ip", inc.get("remote_addr", None)) == "127.0.0.1"
    assert inc.get("method") in ("GET", "POST", "PUT", "DELETE", None)
    assert inc.get("user_agent") == "pytest-agent/1.0"