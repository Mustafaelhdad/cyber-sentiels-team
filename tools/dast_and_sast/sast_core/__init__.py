# sast_core/__init__.py
"""
SAST Core Module

Provides static application security testing capabilities:
- Multi-language support (PHP, JavaScript, TypeScript, Python)
- Regex-based pattern matching for all languages
- AST-based analysis for Python (hybrid detection)
- Configurable rules from YAML files
"""

from .models import Finding, ScanResult
from .scanner import SastScanner

__all__ = ['Finding', 'ScanResult', 'SastScanner']

