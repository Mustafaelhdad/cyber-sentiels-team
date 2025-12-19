# agent/detector.py
"""
Expanded detectors for RASP Agent — many common web attack heuristics.
Rule style: explainable regex + small heuristics to reduce false positives.
Add/adjust patterns as needed for your environment.

Returns tags like:
 - xss, sqli, os_cmd_injection, lfi, rfi_ssrf, xxe, xpath_injection,
   ldap_injection, crlf_injection, open_redirect, insecure_deserialization,
   file_upload_abuse, obfuscation, suspicious_blob
"""
import re
from typing import List, Pattern

class Detector:
    def detect(self, value: str) -> List[str]:
        raise NotImplementedError

class RegexDetector(Detector):
    def __init__(self, patterns: List[Pattern], tag: str):
        self.patterns = patterns
        self.tag = tag

    def detect(self, value: str) -> List[str]:
        s = value or ""
        for p in self.patterns:
            if p.search(s):
                return [self.tag]
        return []

class HeuristicDetector(Detector):
    def __init__(self, fn, tag: str):
        self.fn = fn
        self.tag = tag

    def detect(self, value: str) -> List[str]:
        try:
            return [self.tag] if self.fn(value or "") else []
        except Exception:
            return []

_re_integer_tautology = re.compile(r"\b(or|and)\b\s+[^\s]+=[^\s]+", re.I)
_re_hex = re.compile(r"\b0x[0-9A-Fa-f]+\b")
_re_base64_long = re.compile(r"^[A-Za-z0-9+/=\s]{200,}$")
_re_url = re.compile(r"https?://", re.I)
_re_internal_ip = re.compile(
    r"\b(127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)\b"
)
_re_traversal = re.compile(r"\.\./|\.\.\\|%2e%2e%2f", re.I)
_re_file_paths = re.compile(r"/etc/passwd|/proc/self|/boot|/windows/system32", re.I)

_re_php_serial = re.compile(r'O:\d+:"[A-Za-z_\\]+":\d+:{', re.I)

_re_php_tag = re.compile(r"<\?php|<\?=", re.I)
_re_xml_doctype = re.compile(r"<!DOCTYPE|<!ENTITY", re.I)
_re_xxe_system = re.compile(r'SYSTEM\s+"file:', re.I)
_re_crlf = re.compile(r"(\r\n|\n\r|%0d%0a)", re.I)
_re_redirect_param = re.compile(r"(^|&)(url|redirect|next|return|to)=https?://", re.I)
_re_command_separators = re.compile(r"[;|&`]\s*")
_re_command_keywords = re.compile(
    r"\b(rm|ls|cat|chmod|chown|curl|wget|sudo|python|bash|sh|nc|netcat|perl|php|gcc)\b",
    re.I
)
_re_sqli_union = re.compile(r"\bUNION\b\s+SELECT", re.I)
_re_sqli_sleep = re.compile(r"\bSLEEP\s*\(", re.I)
_re_sql_comment = re.compile(r"(--\s|/\*|\*/|;)\s*$", re.I)
_re_xss_tags = re.compile(r"<\s*script\b|<svg\b|on\w+\s*=", re.I)
_re_xpath_fun = re.compile(r"\bcontains\(|name\(|text\(", re.I)
_re_ldap_chars = re.compile(r"[\(\)\|\&\*]", re.I)
_re_double_ext = re.compile(r"\.\w+\.\w+$")
_re_pickle = re.compile('^(?:\x80\x03|c__builtin__\n)', re.S)
_re_long_hex = re.compile(r'(?:\\x[0-9A-Fa-f]{2}){20,}')


def composite_os_cmd(value: str) -> bool:
    s = value
    if not s or len(s) < 4:
        return False
    if not (_re_command_separators.search(s) or re.search(r'`.+?`', s) or re.search(r'\$\(.+?\)', s)):
        return False
    if _re_command_keywords.search(s) or re.search(r"[/>]", s):
        return True
    return False

def detect_ssrf_rfi(value: str) -> bool:
    s = value
    if not s:
        return False
    if _re_url.search(s):
        if _re_internal_ip.search(s):
            return True
        if re.search(r"(ftp|scp|sftp)://", s, re.I):
            return True
        return True
    return False

def detect_xxe(value: str) -> bool:
    if not value:
        return False
    if _re_xml_doctype.search(value) or _re_xxe_system.search(value):
        return True
    return False

def detect_insecure_deserialize(value: str) -> bool:
    s = (value or "").strip()
    if _re_php_serial.search(s):
        return True
    if _re_pickle.search(s):
        return True
    if _re_base64_long.search(s):
        return True
    return False

def detect_open_redirect(value: str) -> bool:
    if _re_redirect_param.search(value):
        return True
    return False

def default_detectors() -> List[Detector]:
    detectors: List[Detector] = []

    # XSS
    detectors.append(
        RegexDetector(
            [
                _re_xss_tags,
                re.compile(r"javascript:", re.I),
                re.compile(r"data:text/html", re.I)
            ],
            "xss"
        )
    )

    # SQLi
    detectors.append(
        RegexDetector(
            [
                _re_sqli_union,
                _re_sqli_sleep,
                _re_sql_comment,
                _re_integer_tautology
            ],
            "sqli"
        )
    )

    detectors.append(HeuristicDetector(composite_os_cmd, "os_cmd_injection"))

    detectors.append(RegexDetector([_re_traversal, _re_file_paths], "lfi"))

    detectors.append(HeuristicDetector(detect_ssrf_rfi, "rfi_ssrf"))

    detectors.append(HeuristicDetector(detect_xxe, "xxe"))

    detectors.append(RegexDetector([_re_xpath_fun], "xpath_injection"))

    detectors.append(RegexDetector([_re_ldap_chars], "ldap_injection"))

    detectors.append(RegexDetector([_re_crlf], "crlf_injection"))

    
    detectors.append(HeuristicDetector(detect_open_redirect, "open_redirect"))

    detectors.append(HeuristicDetector(detect_insecure_deserialize, "insecure_deserialization"))

    detectors.append(RegexDetector([_re_double_ext, _re_php_tag], "file_upload_abuse"))

    detectors.append(RegexDetector([_re_hex, _re_long_hex], "obfuscation"))

    detectors.append(RegexDetector([_re_base64_long], "suspicious_blob"))

    return detectors

def default_detector_names() -> List[str]:
    return [d.name for d in default_detectors()]