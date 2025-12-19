# dast_core/scanner.py
import os
import requests
import yaml
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from .models import Vulnerability
from typing import Iterable, List, Optional, Callable

# Timeouts & settings
REQUEST_TIMEOUT = 5
REQUEST_TIMEOUT_SHORT = 3
USER_AGENT = "DAST-Scanner/1.0"

class DastScanner:
    """
    محرك فحص DAST — زحف + فحص نماذج (forms).
    - base_url: رابط البداية مثل "http://127.0.0.1:5000"
    - payloads_file: مسار ملف YAML يحتوي التعريفات payloads (يقبل مسار نسبي)
    """
    def __init__(self, base_url: str, payloads_file: Optional[str] = None, payloads: Optional[dict] = None):
        self.base_url = base_url.rstrip('/')
        parsed = urlparse(self.base_url)
        self.target_domain = parsed.netloc
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.crawled_urls = set()      # set of discovered URLs to scan
        self._visited = set()          # for safe crawling recursion
        # payloads_config: structure like { 'xss_payloads': [...], 'sqli_payloads': [...], 'sqli_error_messages': [...] }
        self.payloads_config = payloads if isinstance(payloads, dict) else {}
        if payloads_file:
            self._load_payloads_file(payloads_file)

    def _resolve_path(self, path: str) -> str:
        """حلّ المسار النسبي بناءً على مكان هذا الملف (المشروع)."""
        if os.path.isabs(path):
            return path
        base_dir = os.path.dirname(os.path.dirname(__file__))  # project root (one level up from dast_core)
        return os.path.normpath(os.path.join(base_dir, path))

    def _load_payloads_file(self, payloads_file: str) -> None:
        """يحاول قراءة ملف YAML بأمان ويملأ payloads_config."""
        yaml_path = self._resolve_path(payloads_file)
        try:
            with open(yaml_path, 'r', encoding='utf-8') as yf:
                data = yaml.safe_load(yf)
                if not data:
                    self.payloads_config = {}
                    return
                # If file is dict with named lists
                if isinstance(data, dict):
                    self.payloads_config = data
                # If file is top-level list of payload dicts, try to infer
                elif isinstance(data, list):
                    # try to build a sensible mapping
                    # look for items that contain keys like name/payload/type
                    xss = []
                    sqli = []
                    errors = []
                    for item in data:
                        if isinstance(item, dict):
                            typ = item.get('type', '').lower()
                            if 'xss' in typ or item.get('payload') and '<script>' in str(item.get('payload')):
                                xss.append(item.get('payload') or item.get('name'))
                            elif 'sqli' in typ or item.get('payload') and ("'" in str(item.get('payload')) or " OR " in str(item.get('payload')).upper()):
                                sqli.append(item.get('payload') or item.get('name'))
                            
                            if item.get('error'):
                                errors.append(item.get('error'))
                    self.payloads_config = {
                        'xss_payloads': xss,
                        'sqli_payloads': sqli,
                        'sqli_error_messages': errors
                    }
                else:
                    self.payloads_config = {}
        except (FileNotFoundError, yaml.YAMLError, PermissionError) as e:
            print(f"[DAST ENGINE ERROR] Could not load payloads file '{yaml_path}': {e}")
            self.payloads_config = {}

    # ---------- CRAWLER ----------
    def crawl(self, url: str, logger: Optional[Callable[[str], None]] = None) -> None:
        """
        رحلة الزحف (depth-first) تبدأ من url وتجمع روابط داخل نفس النطاق.
        يستخدم self.crawled_urls كمخزن للروابط المكتشفة.
        """
        log = logger if callable(logger) else (lambda m: None)
        if not url:
            return
        # Normalize
        try:
            url = urljoin(self.base_url + '/', url)
        except Exception:
            return

        parsed = urlparse(url)
        if not parsed.scheme.startswith('http'):
            return
        if parsed.netloc != self.target_domain:
            
            return
        if url in self._visited:
            return

        self._visited.add(url)
        log(f"[DAST] Crawling: {url}")
        try:
            resp = self.session.get(url, timeout=REQUEST_TIMEOUT)
            if resp.status_code >= 400:
                
                pass
            
            self.crawled_urls.add(url)
            soup = BeautifulSoup(resp.content, 'html.parser')
           
            for a in soup.find_all('a', href=True):
                href = a.get('href')
                if not href:
                    continue
                next_url = urljoin(url, href)
                
                if self._is_static_resource(next_url):
                    continue
               
                self.crawl(next_url, logger=log)
        except requests.RequestException as e:
            log(f"[DAST] Error crawling {url}: {e}")

    def _is_static_resource(self, url: str) -> bool:
        """يساعد في تجاهل الروابط المؤدية إلى موارد ثابتة غير مفيدة للفحص."""
        static_exts = ('.jpg', '.jpeg', '.png', '.gif', '.css', '.svg', '.ico', '.pdf', '.zip', '.rar', '.exe')
        parsed = urlparse(url)
        path = parsed.path.lower()
        return any(path.endswith(ext) for ext in static_exts)

    
    def scan_url(self, url: str, logger: Optional[Callable[[str], None]] = None) -> Iterable[Vulnerability]:
        """
        يفحص كل النماذج في صفحة واحدة ويُرجع generator من كائنات Vulnerability.
        """
        log = logger if callable(logger) else (lambda m: None)
        try:
            resp = self.session.get(url, timeout=REQUEST_TIMEOUT)
            soup = BeautifulSoup(resp.content, 'html.parser')
            forms = soup.find_all('form')
        except requests.RequestException:
            return
        if not forms:
            return

        for form in forms:
            action = form.get('action') or ''
            post_url = urljoin(url, action)
            method = (form.get('method') or 'get').lower()

            inputs = form.find_all(['input', 'textarea', 'select'])
            input_names = [i.get('name') for i in inputs if i.get('name')]
            if not input_names:
                
                continue

            # --- XSS testing ---
            for payload in self.payloads_config.get('xss_payloads', []):
                data = {name: payload for name in input_names}
                try:
                    res = self.session.request(method, post_url, data=data, timeout=REQUEST_TIMEOUT_SHORT)
                    
                    if payload and payload in res.text:
                        log(f"[DAST] [+] XSS Vulnerability Found at {post_url}")
                        yield Vulnerability(
                            vuln_type='XSS (Reflected)',
                            url=post_url,
                            payload=str(payload),
                            description='Payload was reflected in the page response.',
                            severity='High'
                        )
                       
                        break
                except requests.RequestException:
                   
                    continue

           
            
            sqli_payloads = self.payloads_config.get('sqli_payloads', [])
            sqli_errors = [e.lower() for e in self.payloads_config.get('sqli_error_messages', []) if isinstance(e, str)]

            if sqli_payloads and sqli_errors:
                for payload in sqli_payloads:
                    data = {name: payload for name in input_names}
                    try:
                        res = self.session.request(method, post_url, data=data, timeout=REQUEST_TIMEOUT_SHORT)
                        body_low = (res.text or "").lower()
                        for error_msg in sqli_errors:
                            if error_msg and error_msg in body_low:
                                log(f"[DAST] [+] SQL Injection Vulnerability Found at {post_url} (error match: {error_msg})")
                                yield Vulnerability(
                                    vuln_type='SQL Injection',
                                    url=post_url,
                                    payload=str(payload),
                                    description=f'Database error detected: \"{error_msg}\"',
                                    severity='Critical'
                                )
                               
                                break
                        else:
                           
                            continue
                       
                        break
                    except requests.RequestException:
                        continue

    
    def run_scan(self, logger: Optional[Callable[[str], None]] = None) -> List[Vulnerability]:
        """
        نقطة الدخول لتشغيل الزحف + الفحص.
        يعيد قائمة بكائنات Vulnerability.
        """
       
        def _log(msg: str):
            if logger is None:
                return
            try:
                if hasattr(logger, 'log') and callable(getattr(logger, 'log')):
                    logger.log(msg)
                elif callable(logger):
                    logger(msg)
                else:
                   
                    pass
            except Exception:
               
                try:
                    print(f"[DAST-LOG-ERROR] {msg}")
                except Exception:
                    pass

        _log("--- Starting DAST Engine ---")
       
        self.crawled_urls.clear()
        self._visited.clear()

        
        self.crawl(self.base_url, logger=_log)

        all_vulns: List[Vulnerability] = []
        
        for url in list(self.crawled_urls):
            for v in self.scan_url(url, logger=_log):
                all_vulns.append(v)

        _log(f"--- DAST Engine Finished. Found {len(all_vulns)} vulnerabilities. ---")
        return all_vulns
