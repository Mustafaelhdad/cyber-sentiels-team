from dataclasses import dataclass

@dataclass
class Vulnerability:
    """
    A data class to represent a single vulnerability from the DAST scanner.
    This provides a structured way to store vulnerability details.
    """
    vuln_type: str
    url: str
    payload: str
    description: str
    severity: str
