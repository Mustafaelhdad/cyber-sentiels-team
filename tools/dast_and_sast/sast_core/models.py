# sast_core/models.py
from dataclasses import dataclass

@dataclass
class Finding:
    rule_id: str
    description: str
    file_path: str
    line_number: int
    line_content: str
    severity: str