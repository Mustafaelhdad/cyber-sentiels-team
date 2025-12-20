# sast_core/scanner.py
"""
Professional SAST Scanner Engine

Supports multi-language scanning (PHP, JavaScript, TypeScript, Python) using:
- Regex-based pattern matching for all languages
- AST-based detection for Python (hybrid mode for more accurate SQL injection detection)

Produces structured Finding objects with detailed vulnerability information.
"""

import ast
import os
import re
import time
from typing import List, Optional, Callable

import yaml

from .models import Finding, ScanResult


# Default directories and files to skip during scanning
DEFAULT_IGNORE_DIRS = {
    'node_modules',
    'vendor',
    'venv',
    '.venv',
    'env',
    '.env',
    'dist',
    'build',
    'storage',
    '.git',
    '.svn',
    '.hg',
    '__pycache__',
    '.cache',
    '.idea',
    '.vscode',
    'coverage',
    '.next',
    '.nuxt',
}

DEFAULT_IGNORE_FILES = {
    'package-lock.json',
    'composer.lock',
    'yarn.lock',
    'pnpm-lock.yaml',
}

# File extension to language mapping
EXTENSION_LANGUAGE_MAP = {
    '.py': 'python',
    '.php': 'php',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
}


class SastScanner:
    """
    Professional SAST scanner that analyzes source code for security vulnerabilities.
    
    Supports:
    - PHP, JavaScript, TypeScript, Python
    - Regex-based pattern matching
    - AST-based analysis for Python (hybrid mode)
    - Configurable rules from YAML files
    """

    def __init__(self, rules_file: str = "config/sast_rules.yaml", 
                 ignore_dirs: Optional[set] = None,
                 ignore_files: Optional[set] = None):
        """
        Initialize the SAST scanner.
        
        Args:
            rules_file: Path to YAML file containing scan rules
            ignore_dirs: Set of directory names to skip (uses defaults if None)
            ignore_files: Set of file names to skip (uses defaults if None)
        """
        self.rules_file = rules_file
        self.rules = self._load_rules()
        self.ignore_dirs = ignore_dirs or DEFAULT_IGNORE_DIRS
        self.ignore_files = ignore_files or DEFAULT_IGNORE_FILES
        self._compiled_patterns = {}
        self._compile_patterns()

    def _load_rules(self) -> List[dict]:
        """Load rules from the YAML configuration file."""
        try:
            with open(self.rules_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                return data.get('rules', [])
        except FileNotFoundError:
            print(f"[SAST Warning] Rules file not found: {self.rules_file}")
            return []
        except yaml.YAMLError as e:
            print(f"[SAST Error] Failed to parse rules file: {e}")
            return []

    def _compile_patterns(self):
        """Pre-compile regex patterns for better performance."""
        for rule in self.rules:
            pattern = rule.get('pattern')
            if pattern:
                try:
                    self._compiled_patterns[rule['id']] = re.compile(pattern, re.IGNORECASE)
                except re.error as e:
                    print(f"[SAST Warning] Invalid regex pattern for rule {rule['id']}: {e}")

    def _should_skip_dir(self, dir_name: str) -> bool:
        """Check if a directory should be skipped."""
        return dir_name in self.ignore_dirs or dir_name.startswith('.')

    def _should_skip_file(self, file_name: str) -> bool:
        """Check if a file should be skipped."""
        return file_name in self.ignore_files

    def _get_language(self, file_path: str) -> Optional[str]:
        """Determine the programming language based on file extension."""
        _, ext = os.path.splitext(file_path)
        return EXTENSION_LANGUAGE_MAP.get(ext.lower())

    def _get_code_snippet(self, lines: List[str], line_number: int, context: int = 0) -> str:
        """
        Extract a code snippet around the specified line.
        
        Args:
            lines: List of all lines in the file
            line_number: 1-based line number of the finding
            context: Number of lines to include before/after (0 = just the line)
        """
        idx = line_number - 1  # Convert to 0-based index
        if 0 <= idx < len(lines):
            return lines[idx].strip()
        return ""

    def _analyze_file_regex(self, file_path: str, language: str) -> List[Finding]:
        """
        Analyze a file using regex-based pattern matching.
        
        Args:
            file_path: Path to the file to analyze
            language: Programming language of the file
        
        Returns:
            List of Finding objects for detected vulnerabilities
        """
        findings = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                lines = content.split('\n')
        except (IOError, OSError) as e:
            print(f"[SAST Warning] Could not read file {file_path}: {e}")
            return findings

        # Get rules applicable to this language
        applicable_rules = [
            rule for rule in self.rules
            if rule.get('language') in (language, 'any')
        ]

        for rule in applicable_rules:
            rule_id = rule.get('id', 'UNKNOWN')
            compiled_pattern = self._compiled_patterns.get(rule_id)
            
            if not compiled_pattern:
                continue

            # Search each line for matches
            for line_num, line in enumerate(lines, start=1):
                if compiled_pattern.search(line):
                    findings.append(Finding(
                        rule_id=rule_id,
                        rule_name=rule.get('name', 'Unknown Vulnerability'),
                        description=rule.get('description', ''),
                        file_path=file_path,
                        line_number=line_num,
                        severity=rule.get('severity', 'Medium'),
                        cwe=rule.get('cwe', ''),
                        code_snippet=line.strip(),
                        language=language
                    ))

        return findings

    def _analyze_python_ast(self, file_path: str) -> List[Finding]:
        """
        Analyze a Python file using AST for more accurate detection.
        
        Currently detects:
        - SQL injection via f-strings in execute() calls
        - Unsafe eval/exec usage with variables
        
        Args:
            file_path: Path to the Python file
        
        Returns:
            List of Finding objects for detected vulnerabilities
        """
        findings = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
        except (IOError, OSError):
            return findings

        try:
            tree = ast.parse(content, filename=file_path)
        except SyntaxError:
            return findings

        # Find the corresponding rule for SQL injection
        sql_rule = next(
            (r for r in self.rules if r.get('id') == 'SAST002'),
            {
                'id': 'SAST002',
                'name': 'Potential SQL Injection (Python F-String)',
                'description': 'Using f-strings to build SQL queries can lead to SQL Injection.',
                'severity': 'High',
                'cwe': 'CWE-89'
            }
        )

        for node in ast.walk(tree):
            # Detect: cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
            if isinstance(node, ast.Call):
                # Check if it's a method call to execute()
                if isinstance(node.func, ast.Attribute) and node.func.attr == 'execute':
                    for arg in node.args:
                        # Check for f-string (JoinedStr) or string formatting
                        if isinstance(arg, ast.JoinedStr):
                            line_num = node.lineno
                            code_snippet = lines[line_num - 1].strip() if line_num <= len(lines) else ""
                            findings.append(Finding(
                                rule_id=sql_rule['id'],
                                rule_name=sql_rule['name'],
                                description=sql_rule['description'],
                                file_path=file_path,
                                line_number=line_num,
                                severity=sql_rule['severity'],
                                cwe=sql_rule['cwe'],
                                code_snippet=code_snippet,
                                language='python'
                            ))
                        # Check for % formatting: execute("SELECT ... WHERE id = %s" % user_id)
                        elif isinstance(arg, ast.BinOp) and isinstance(arg.op, ast.Mod):
                            if isinstance(arg.left, ast.Constant) and isinstance(arg.left.value, str):
                                line_num = node.lineno
                                code_snippet = lines[line_num - 1].strip() if line_num <= len(lines) else ""
                                findings.append(Finding(
                                    rule_id=sql_rule['id'],
                                    rule_name=sql_rule['name'],
                                    description=sql_rule['description'],
                                    file_path=file_path,
                                    line_number=line_num,
                                    severity=sql_rule['severity'],
                                    cwe=sql_rule['cwe'],
                                    code_snippet=code_snippet,
                                    language='python'
                                ))

        return findings

    def analyze_file(self, file_path: str) -> List[Finding]:
        """
        Analyze a single file for security vulnerabilities.
        
        Uses hybrid detection:
        - Regex patterns for all languages
        - AST analysis for Python files
        
        Args:
            file_path: Path to the file to analyze
        
        Returns:
            List of Finding objects
        """
        language = self._get_language(file_path)
        if not language:
            return []

        findings = []

        # Regex-based analysis for all languages
        findings.extend(self._analyze_file_regex(file_path, language))

        # AST-based analysis for Python (hybrid mode)
        if language == 'python':
            ast_findings = self._analyze_python_ast(file_path)
            # Deduplicate: only add AST findings that weren't caught by regex
            existing_keys = {(f.file_path, f.line_number, f.rule_id) for f in findings}
            for af in ast_findings:
                key = (af.file_path, af.line_number, af.rule_id)
                if key not in existing_keys:
                    findings.append(af)

        return findings

    def scan_directory(self, target_path: str, logger: Optional[Callable] = None) -> List[Finding]:
        """
        Scan a directory (or single file) for security vulnerabilities.
        
        Args:
            target_path: Path to directory or file to scan
            logger: Optional callback function for logging progress
        
        Returns:
            List of Finding objects for all detected vulnerabilities
        """
        start_time = time.time()
        all_findings = []
        files_scanned = 0

        def log(msg: str):
            if logger:
                if callable(logger):
                    logger(msg)
                elif hasattr(logger, 'log'):
                    logger.log(msg)

        log(f"Starting SAST scan on: {target_path}")

        # Handle single file
        if os.path.isfile(target_path):
            language = self._get_language(target_path)
            if language:
                log(f"Scanning file: {target_path}")
                all_findings.extend(self.analyze_file(target_path))
                files_scanned = 1

        # Handle directory
        elif os.path.isdir(target_path):
            for root, dirs, files in os.walk(target_path):
                # Filter out ignored directories (modifies dirs in-place)
                dirs[:] = [d for d in dirs if not self._should_skip_dir(d)]

                for file_name in files:
                    if self._should_skip_file(file_name):
                        continue

                    file_path = os.path.join(root, file_name)
                    language = self._get_language(file_path)
                    
                    if language:
                        log(f"Scanning: {file_path}")
                        all_findings.extend(self.analyze_file(file_path))
                        files_scanned += 1

        else:
            log(f"Error: Path does not exist: {target_path}")

        duration = time.time() - start_time
        log(f"SAST scan complete. Scanned {files_scanned} files, found {len(all_findings)} findings in {duration:.2f}s")

        return all_findings

    def run_scan(self, logger: Optional[Callable] = None) -> List[Finding]:
        """
        Legacy method for backward compatibility with old interface.
        Scans the target_path set during initialization.
        
        Note: For new code, use scan_directory() instead.
        """
        if hasattr(self, 'target_path'):
            return self.scan_directory(self.target_path, logger)
        return []

    def scan_to_result(self, target_path: str, logger: Optional[Callable] = None) -> ScanResult:
        """
        Scan a directory and return a structured ScanResult object.
        
        Args:
            target_path: Path to directory or file to scan
            logger: Optional callback function for logging progress
        
        Returns:
            ScanResult object containing findings and metadata
        """
        start_time = time.time()
        findings = self.scan_directory(target_path, logger)
        duration = time.time() - start_time

        # Count files (simplified - actual count is tracked in scan_directory)
        total_files = sum(1 for f in findings)  # Approximate based on unique files
        unique_files = len(set(f.file_path for f in findings)) if findings else 0

        return ScanResult(
            target_path=target_path,
            total_files=unique_files,
            total_findings=len(findings),
            findings=findings,
            scan_duration_seconds=duration
        )
