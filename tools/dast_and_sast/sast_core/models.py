# sast_core/models.py
from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class Finding:
    """
    Represents a single SAST finding/vulnerability.
    
    Fields:
        rule_id: Unique identifier for the rule (e.g., SAST001)
        rule_name: Human-readable name of the vulnerability type
        description: Detailed description of the vulnerability
        file_path: Path to the file containing the vulnerability
        line_number: Line number where the vulnerability was found
        severity: Severity level (Critical, High, Medium, Low, Info)
        cwe: Common Weakness Enumeration ID (e.g., CWE-89)
        code_snippet: The actual code that triggered the finding
        language: Programming language of the file (php, python, javascript, typescript)
    """
    rule_id: str
    rule_name: str
    description: str
    file_path: str
    line_number: int
    severity: str
    cwe: str
    code_snippet: str
    language: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert finding to dictionary for JSON serialization."""
        return asdict(self)


@dataclass
class ScanResult:
    """
    Represents the overall result of a SAST scan.
    
    Fields:
        target_path: The path that was scanned
        total_files: Number of files scanned
        total_findings: Number of findings discovered
        findings: List of Finding objects
        scan_duration_seconds: How long the scan took
    """
    target_path: str
    total_files: int
    total_findings: int
    findings: list
    scan_duration_seconds: float = 0.0

    def to_dict(self) -> dict:
        """Convert scan result to dictionary for JSON serialization."""
        return {
            "target_path": self.target_path,
            "total_files": self.total_files,
            "total_findings": self.total_findings,
            "scan_duration_seconds": self.scan_duration_seconds,
            "findings": [f.to_dict() if hasattr(f, 'to_dict') else f for f in self.findings]
        }
