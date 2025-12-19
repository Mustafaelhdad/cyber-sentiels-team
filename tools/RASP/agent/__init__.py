"""
===============================================================
RASP Agent Package
===============================================================

This package implements a lightweight Runtime Application Self-Protection (RASP)
agent designed for student research and graduation projects.

Main Features:
- Request monitoring and input inspection.
- Built-in detectors for common web attacks.
- Automatic incident logging and optional API reporting.
- Easy integration with Flask or any Python web framework.
===============================================================
"""

from .monitor import RASPMonitor  
from .detector import Detector, RegexDetector 
from .utils import now_ts, make_id, log_incident  

__all__ = [
    "RASPMonitor",
    "Detector",
    "RegexDetector",
    "now_ts",
    "make_id",
    "log_incident"
]

__version__ = "1.0.0"
__author__ = "Delta University - AI Faculty Graduation Project"
__license__ = "Educational Use Only"
