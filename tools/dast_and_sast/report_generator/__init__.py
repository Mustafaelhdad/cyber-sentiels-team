# report_generator/__init__.py
"""
Report Generator Module

Generates security scan reports in JSON and HTML formats.
"""

from .generator import generate_report, generate_json_findings

__all__ = ['generate_report', 'generate_json_findings']

