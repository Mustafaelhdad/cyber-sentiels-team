#!/usr/bin/env python3
"""
SOAR (Security Orchestration, Automation and Response) API
Cyber Sentinels Team
Version: 1.0.0

This tool provides automated incident response capabilities:
- Threat intelligence lookup
- Automated IP blocking
- Ticket creation
- Playbook execution
- SIEM integration
"""

import os
import re
import json
import time
import threading
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict, deque
from flask import Flask, request, render_template_string, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import logging
import requests

# Configure logging
LOG_DIR = Path(os.environ.get('SOAR_LOG_DIR', '/app/logs'))
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'soar.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('SOAR-Tool')

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SOAR_SECRET_KEY', 'soar-secret-key-change-in-production')

# Use gevent for production, threading for development
async_mode = os.environ.get('SOAR_ASYNC_MODE', 'gevent')
socketio = SocketIO(app, async_mode=async_mode, cors_allowed_origins="*")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get('SOAR_DATA_DIR', '/data'))
REPORTS_DIR = Path(os.environ.get('SOAR_REPORTS_DIR', '/app/reports'))

# Create necessary directories
DATA_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Database path
DB_PATH = DATA_DIR / 'soar.db'
BLOCKLIST_PATH = DATA_DIR / 'blocked_ips.log'
PLAYBOOKS_PATH = DATA_DIR / 'playbooks.json'

# SIEM integration
SIEM_API_URL = os.environ.get('SIEM_API_URL', 'http://siem:5000')

# =========================
# Threat Intelligence (static blocklist + configurable)
# =========================
DEFAULT_MALICIOUS_IPS = [
    "185.220.101.45",
    "185.220.101.46",
    "91.214.124.143",
    "45.155.205.233",
    "89.248.167.131",
    "193.169.245.0/24"
]

# Load additional malicious IPs from environment
EXTRA_MALICIOUS_IPS = os.environ.get('SOAR_MALICIOUS_IPS', '').split(',')
MALICIOUS_IPS = set(ip.strip() for ip in DEFAULT_MALICIOUS_IPS + EXTRA_MALICIOUS_IPS if ip.strip())

# Malicious patterns for detection
MALICIOUS_PATTERNS = [
    r'(?i)(?:union\s+select|select\s+.*\s+from|insert\s+into|delete\s+from|drop\s+table)',  # SQL Injection
    r'(?i)<script[^>]*>.*?</script>',  # XSS
    r'(?i)(?:\.\.\/|\.\.\\)',  # Path Traversal
    r'(?i)(?:cmd\.exe|powershell|/bin/(?:ba)?sh)',  # Command Injection
    r'(?i)(?:eval\(|exec\(|system\()',  # Code Execution
]

# =========================
# Database Setup
# =========================
def init_db():
    """Initialize SQLite database for SOAR incidents and actions"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Incidents table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id TEXT UNIQUE NOT NULL,
            alert_id TEXT,
            source_ip TEXT,
            attack_type TEXT,
            severity TEXT,
            status TEXT DEFAULT 'open',
            decision TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            metadata TEXT
        )
    ''')
    
    # Actions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            action_detail TEXT,
            status TEXT DEFAULT 'pending',
            result TEXT,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents(incident_id)
        )
    ''')
    
    # Playbooks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS playbooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            trigger_conditions TEXT,
            actions TEXT,
            enabled INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Blocked IPs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS blocked_ips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT UNIQUE NOT NULL,
            reason TEXT,
            incident_id TEXT,
            blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            active INTEGER DEFAULT 1
        )
    ''')
    
    conn.commit()
    conn.close()
    logger.info("Database initialized successfully")

# Initialize database on startup
init_db()

# =========================
# Default Playbooks
# =========================
DEFAULT_PLAYBOOKS = [
    {
        "name": "Block Malicious IP",
        "description": "Automatically block IPs identified as malicious by threat intelligence",
        "trigger_conditions": {"decision": "MALICIOUS"},
        "actions": ["block_ip", "create_ticket", "notify"],
        "enabled": True
    },
    {
        "name": "SQL Injection Response",
        "description": "Response playbook for SQL injection attacks",
        "trigger_conditions": {"attack_type": "SQL Injection"},
        "actions": ["block_ip", "create_ticket", "log_incident", "notify"],
        "enabled": True
    },
    {
        "name": "Brute Force Response",
        "description": "Response playbook for brute force attacks",
        "trigger_conditions": {"attack_type": "Brute Force"},
        "actions": ["block_ip", "create_ticket", "notify"],
        "enabled": True
    },
    {
        "name": "XSS Attack Response",
        "description": "Response playbook for cross-site scripting attacks",
        "trigger_conditions": {"attack_type": "XSS"},
        "actions": ["block_ip", "create_ticket", "log_incident"],
        "enabled": True
    }
]

def load_playbooks():
    """Load playbooks from database or initialize with defaults"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM playbooks")
    count = cursor.fetchone()[0]
    
    if count == 0:
        # Insert default playbooks
        for playbook in DEFAULT_PLAYBOOKS:
            cursor.execute('''
                INSERT INTO playbooks (name, description, trigger_conditions, actions, enabled)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                playbook['name'],
                playbook['description'],
                json.dumps(playbook['trigger_conditions']),
                json.dumps(playbook['actions']),
                1 if playbook['enabled'] else 0
            ))
        conn.commit()
        logger.info("Default playbooks loaded")
    
    conn.close()

load_playbooks()

# =========================
# In-memory storage
# =========================
execution_logs = deque(maxlen=1000)
active_incidents = {}

# =========================
# Threat Intelligence Functions
# =========================
def check_ip_reputation(ip):
    """Check if IP is in malicious list or matches malicious patterns"""
    if not ip:
        return False, "No IP provided"
    
    # Direct match
    if ip in MALICIOUS_IPS:
        return True, "IP found in threat intelligence blocklist"
    
    # Check CIDR ranges (simplified)
    for malicious in MALICIOUS_IPS:
        if '/' in malicious:
            # Simple prefix match for demo
            prefix = malicious.split('/')[0].rsplit('.', 1)[0]
            if ip.startswith(prefix):
                return True, f"IP matches malicious range {malicious}"
    
    return False, "IP not found in threat intelligence"


def check_payload_patterns(payload):
    """Check if payload contains malicious patterns"""
    if not payload:
        return False, "No payload to analyze"
    
    for pattern in MALICIOUS_PATTERNS:
        if re.search(pattern, payload):
            return True, f"Malicious pattern detected: {pattern}"
    
    return False, "No malicious patterns detected"


# =========================
# Action Functions
# =========================
def block_ip(ip, incident_id=None, reason=None, duration_hours=24):
    """Block an IP address"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        expires_at = datetime.now() + timedelta(hours=duration_hours) if duration_hours else None
        
        cursor.execute('''
            INSERT OR REPLACE INTO blocked_ips (ip_address, reason, incident_id, blocked_at, expires_at, active)
            VALUES (?, ?, ?, ?, ?, 1)
        ''', (ip, reason or "Automated block by SOAR", incident_id, datetime.now(), expires_at))
        
        conn.commit()
        conn.close()
        
        # Also write to blocklist file for compatibility
        with open(BLOCKLIST_PATH, 'a') as f:
            f.write(f"{datetime.now().isoformat()}|{ip}|{incident_id}|{reason}\n")
        
        logger.info(f"Blocked IP: {ip} (incident: {incident_id})")
        return True, f"IP {ip} blocked successfully"
    except Exception as e:
        logger.error(f"Failed to block IP {ip}: {e}")
        return False, str(e)


def unblock_ip(ip):
    """Unblock an IP address"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute("UPDATE blocked_ips SET active = 0 WHERE ip_address = ?", (ip,))
        conn.commit()
        conn.close()
        logger.info(f"Unblocked IP: {ip}")
        return True, f"IP {ip} unblocked successfully"
    except Exception as e:
        logger.error(f"Failed to unblock IP {ip}: {e}")
        return False, str(e)


def create_ticket(alert_id, ip, severity, attack_type, description=None):
    """Create an incident ticket"""
    ticket_id = f"TICKET-{datetime.now().strftime('%Y%m%d%H%M%S')}-{alert_id}"
    ticket = {
        "ticket_id": ticket_id,
        "alert_id": alert_id,
        "source_ip": ip,
        "severity": severity,
        "attack_type": attack_type,
        "description": description or f"Automated ticket for {attack_type} from {ip}",
        "status": "open",
        "created_at": datetime.now().isoformat()
    }
    logger.info(f"Ticket created: {ticket_id}")
    return ticket


def log_action(incident_id, action_type, action_detail, status="completed", result=None):
    """Log an action to the database"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO actions (incident_id, action_type, action_detail, status, result)
            VALUES (?, ?, ?, ?, ?)
        ''', (incident_id, action_type, action_detail, status, result))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Failed to log action: {e}")
        return False


# =========================
# SOAR Engine
# =========================
class SOAREngine:
    """Core SOAR automation engine"""
    
    def __init__(self):
        self.incidents_processed = 0
        self.actions_executed = 0
    
    def process_alert(self, alert_data):
        """Process an incoming alert and execute appropriate playbook"""
        logs = []
        
        # Extract alert information
        alert_id = alert_data.get('alert_id', f"ALERT-{datetime.now().strftime('%Y%m%d%H%M%S')}")
        source_ip = alert_data.get('source_ip')
        attack_type = alert_data.get('type') or alert_data.get('attack_type', 'Unknown')
        severity = alert_data.get('severity', 'MEDIUM')
        payload = alert_data.get('payload', '')
        
        incident_id = f"INC-{datetime.now().strftime('%Y%m%d%H%M%S')}-{self.incidents_processed + 1:04d}"
        
        logs.append(f"[{datetime.now().isoformat()}] Processing alert: {alert_id}")
        logs.append(f"Source IP: {source_ip}")
        logs.append(f"Attack Type: {attack_type}")
        logs.append(f"Severity: {severity}")
        
        # Threat intelligence check
        is_malicious_ip, ip_reason = check_ip_reputation(source_ip)
        is_malicious_payload, payload_reason = check_payload_patterns(payload)
        
        is_malicious = is_malicious_ip or is_malicious_payload
        decision = "MALICIOUS" if is_malicious else "CLEAN"
        
        if is_malicious_ip:
            logs.append(f"Threat Intel: {ip_reason}")
        if is_malicious_payload:
            logs.append(f"Payload Analysis: {payload_reason}")
        
        logs.append(f"Decision: {decision}")
        
        # Create incident record
        self._create_incident(incident_id, alert_id, source_ip, attack_type, severity, decision, alert_data)
        self.incidents_processed += 1
        
        # Execute playbook actions
        actions_taken = []
        if is_malicious:
            # Find matching playbook
            playbook = self._find_matching_playbook(attack_type, decision, severity)
            
            if playbook:
                logs.append(f"Executing playbook: {playbook['name']}")
                actions = json.loads(playbook['actions']) if isinstance(playbook['actions'], str) else playbook['actions']
                
                for action in actions:
                    result = self._execute_action(action, incident_id, alert_id, source_ip, severity, attack_type)
                    logs.append(result)
                    actions_taken.append({"action": action, "result": result})
                    self.actions_executed += 1
            else:
                # Default actions for malicious activity
                logs.append("No specific playbook found, executing default response")
                
                # Block IP
                success, msg = block_ip(source_ip, incident_id, f"Automated block: {attack_type}")
                logs.append(f"Action: Block IP - {msg}")
                actions_taken.append({"action": "block_ip", "result": msg})
                
                # Create ticket
                ticket = create_ticket(alert_id, source_ip, severity, attack_type)
                logs.append(f"Action: Create Ticket - {ticket['ticket_id']}")
                actions_taken.append({"action": "create_ticket", "result": ticket['ticket_id']})
        else:
            logs.append("No malicious activity detected - monitoring only")
        
        # Update incident status
        self._update_incident_status(incident_id, "processed" if not is_malicious else "mitigated")
        
        # Store execution log
        execution_log = {
            "incident_id": incident_id,
            "alert_id": alert_id,
            "timestamp": datetime.now().isoformat(),
            "decision": decision,
            "logs": logs,
            "actions": actions_taken
        }
        execution_logs.append(execution_log)
        
        # Emit real-time update
        socketio.emit('soar_update', execution_log)
        
        return {
            "incident_id": incident_id,
            "alert_id": alert_id,
            "decision": decision,
            "is_malicious": is_malicious,
            "actions_taken": actions_taken,
            "logs": logs
        }
    
    def _create_incident(self, incident_id, alert_id, source_ip, attack_type, severity, decision, metadata):
        """Create an incident record in the database"""
        try:
            conn = sqlite3.connect(str(DB_PATH))
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO incidents (incident_id, alert_id, source_ip, attack_type, severity, status, decision, metadata)
                VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
            ''', (incident_id, alert_id, source_ip, attack_type, severity, decision, json.dumps(metadata)))
            conn.commit()
            conn.close()
            active_incidents[incident_id] = {
                "alert_id": alert_id,
                "source_ip": source_ip,
                "attack_type": attack_type,
                "severity": severity,
                "decision": decision,
                "status": "open",
                "created_at": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to create incident: {e}")
    
    def _update_incident_status(self, incident_id, status):
        """Update incident status"""
        try:
            conn = sqlite3.connect(str(DB_PATH))
            cursor = conn.cursor()
            resolved_at = datetime.now() if status in ['resolved', 'mitigated', 'closed'] else None
            cursor.execute('''
                UPDATE incidents SET status = ?, updated_at = ?, resolved_at = ?
                WHERE incident_id = ?
            ''', (status, datetime.now(), resolved_at, incident_id))
            conn.commit()
            conn.close()
            
            if incident_id in active_incidents:
                active_incidents[incident_id]['status'] = status
        except Exception as e:
            logger.error(f"Failed to update incident status: {e}")
    
    def _find_matching_playbook(self, attack_type, decision, severity):
        """Find a playbook matching the incident conditions"""
        try:
            conn = sqlite3.connect(str(DB_PATH))
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM playbooks WHERE enabled = 1")
            playbooks = cursor.fetchall()
            conn.close()
            
            for pb in playbooks:
                conditions = json.loads(pb[3]) if pb[3] else {}
                
                # Check if conditions match
                if conditions.get('attack_type') and conditions['attack_type'].lower() not in attack_type.lower():
                    continue
                if conditions.get('decision') and conditions['decision'] != decision:
                    continue
                if conditions.get('severity') and conditions['severity'].upper() != severity.upper():
                    continue
                
                return {
                    "id": pb[0],
                    "name": pb[1],
                    "description": pb[2],
                    "trigger_conditions": conditions,
                    "actions": pb[4]
                }
            
            return None
        except Exception as e:
            logger.error(f"Failed to find playbook: {e}")
            return None
    
    def _execute_action(self, action, incident_id, alert_id, source_ip, severity, attack_type):
        """Execute a single playbook action"""
        result = ""
        
        if action == "block_ip":
            success, msg = block_ip(source_ip, incident_id, f"Playbook action: {attack_type}")
            result = f"Block IP: {msg}"
            log_action(incident_id, "block_ip", source_ip, "completed" if success else "failed", msg)
        
        elif action == "create_ticket":
            ticket = create_ticket(alert_id, source_ip, severity, attack_type)
            result = f"Create Ticket: {ticket['ticket_id']}"
            log_action(incident_id, "create_ticket", ticket['ticket_id'], "completed", json.dumps(ticket))
        
        elif action == "notify":
            # Simulated notification
            result = f"Notification sent for incident {incident_id}"
            log_action(incident_id, "notify", f"Incident {incident_id}", "completed")
        
        elif action == "log_incident":
            result = f"Incident logged: {incident_id}"
            log_action(incident_id, "log_incident", incident_id, "completed")
        
        elif action == "isolate_host":
            result = f"Host isolation requested for {source_ip}"
            log_action(incident_id, "isolate_host", source_ip, "pending")
        
        else:
            result = f"Unknown action: {action}"
            log_action(incident_id, action, "unknown", "failed", "Unknown action type")
        
        return result


# Global SOAR engine instance
soar_engine = SOAREngine()

# =========================
# HTML Template
# =========================
HTML_TEMPLATE = r'''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SOAR Automation Platform</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            color: #e8e8e8;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        header {
            text-align: center;
            padding: 30px 0;
            border-bottom: 2px solid #00ff88;
            margin-bottom: 30px;
        }
        h1 {
            font-size: 2.5em;
            color: #00ff88;
            text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
        }
        .subtitle {
            color: #888;
            margin-top: 10px;
        }
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(0, 255, 136, 0.2);
            border-radius: 12px;
            padding: 25px;
            text-align: center;
            transition: all 0.3s ease;
        }
        .stat-card:hover {
            transform: translateY(-5px);
            border-color: #00ff88;
            box-shadow: 0 10px 30px rgba(0, 255, 136, 0.2);
        }
        .stat-card h3 {
            color: #888;
            font-size: 0.9em;
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        .stat-card .value {
            font-size: 2.5em;
            font-weight: bold;
            color: #00ff88;
        }
        .stat-card.danger .value {
            color: #ff4757;
        }
        .stat-card.warning .value {
            color: #ffa502;
        }
        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }
        @media (max-width: 900px) {
            .main-content {
                grid-template-columns: 1fr;
            }
        }
        .panel {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 25px;
        }
        .panel h2 {
            color: #00ff88;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(0, 255, 136, 0.3);
        }
        .alert-form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .form-group label {
            color: #888;
            font-size: 0.9em;
        }
        .form-group input, .form-group select, .form-group textarea {
            padding: 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.3);
            color: #fff;
            font-size: 1em;
        }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
            outline: none;
            border-color: #00ff88;
        }
        button {
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        .btn-primary {
            background: linear-gradient(135deg, #00ff88, #00cc6a);
            color: #1a1a2e;
        }
        .btn-primary:hover {
            transform: scale(1.02);
            box-shadow: 0 5px 20px rgba(0, 255, 136, 0.4);
        }
        .btn-danger {
            background: linear-gradient(135deg, #ff4757, #ff6b6b);
            color: #fff;
        }
        .log-viewer {
            background: #0a0a15;
            border-radius: 8px;
            padding: 15px;
            height: 400px;
            overflow-y: auto;
            font-family: 'Consolas', monospace;
            font-size: 0.9em;
            line-height: 1.6;
        }
        .log-entry {
            padding: 8px 12px;
            margin: 5px 0;
            border-radius: 4px;
            border-left: 3px solid;
        }
        .log-entry.info {
            background: rgba(0, 136, 255, 0.1);
            border-color: #0088ff;
        }
        .log-entry.success {
            background: rgba(0, 255, 136, 0.1);
            border-color: #00ff88;
        }
        .log-entry.warning {
            background: rgba(255, 165, 2, 0.1);
            border-color: #ffa502;
        }
        .log-entry.danger {
            background: rgba(255, 71, 87, 0.1);
            border-color: #ff4757;
        }
        .incident-list {
            max-height: 300px;
            overflow-y: auto;
        }
        .incident-item {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            border-left: 4px solid;
        }
        .incident-item.malicious {
            border-color: #ff4757;
        }
        .incident-item.clean {
            border-color: #00ff88;
        }
        .incident-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .incident-id {
            font-weight: bold;
            color: #00ff88;
        }
        .incident-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            text-transform: uppercase;
        }
        .status-open {
            background: rgba(255, 165, 2, 0.2);
            color: #ffa502;
        }
        .status-mitigated {
            background: rgba(0, 255, 136, 0.2);
            color: #00ff88;
        }
        .status-closed {
            background: rgba(136, 136, 136, 0.2);
            color: #888;
        }
        .blocked-ips {
            max-height: 200px;
            overflow-y: auto;
        }
        .blocked-ip {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: rgba(255, 71, 87, 0.1);
            border-radius: 6px;
            margin-bottom: 8px;
        }
        .blocked-ip-address {
            font-family: monospace;
            color: #ff4757;
        }
        .tab-container {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 10px;
        }
        .tab {
            padding: 10px 20px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            color: #888;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .tab:hover, .tab.active {
            background: rgba(0, 255, 136, 0.1);
            border-color: #00ff88;
            color: #00ff88;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }
        .status-online {
            background: #00ff88;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🛡️ SOAR Automation Platform</h1>
            <p class="subtitle">Security Orchestration, Automation and Response</p>
        </header>
        
        <div class="dashboard">
            <div class="stat-card">
                <h3>Incidents Processed</h3>
                <div class="value" id="incidentsProcessed">0</div>
            </div>
            <div class="stat-card danger">
                <h3>Threats Detected</h3>
                <div class="value" id="threatsDetected">0</div>
            </div>
            <div class="stat-card">
                <h3>Actions Executed</h3>
                <div class="value" id="actionsExecuted">0</div>
            </div>
            <div class="stat-card warning">
                <h3>IPs Blocked</h3>
                <div class="value" id="ipsBlocked">0</div>
            </div>
            <div class="stat-card">
                <h3>System Status</h3>
                <div class="value">
                    <span class="status-indicator status-online"></span>
                    <span id="systemStatus">ONLINE</span>
                </div>
            </div>
        </div>
        
        <div class="main-content">
            <div class="panel">
                <h2>Process Alert</h2>
                <div class="tab-container">
                    <button class="tab active" onclick="switchTab('manual')">Manual Input</button>
                    <button class="tab" onclick="switchTab('json')">JSON Alert</button>
                </div>
                
                <div id="manual" class="tab-content active">
                    <form class="alert-form" onsubmit="processManualAlert(event)">
                        <div class="form-group">
                            <label>Alert ID</label>
                            <input type="text" id="alertId" placeholder="SIEM-001" required>
                        </div>
                        <div class="form-group">
                            <label>Source IP</label>
                            <input type="text" id="sourceIp" placeholder="192.168.1.100" required>
                        </div>
                        <div class="form-group">
                            <label>Attack Type</label>
                            <select id="attackType">
                                <option value="Brute Force">Brute Force Attack</option>
                                <option value="SQL Injection">SQL Injection</option>
                                <option value="XSS">Cross-Site Scripting (XSS)</option>
                                <option value="DDoS">DDoS Attack</option>
                                <option value="Malware">Malware Detection</option>
                                <option value="Phishing">Phishing Attempt</option>
                                <option value="Unknown">Unknown</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Severity</label>
                            <select id="severity">
                                <option value="Critical">Critical</option>
                                <option value="High" selected>High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>
                        <button type="submit" class="btn-primary">🚀 Run SOAR Playbook</button>
                    </form>
                </div>
                
                <div id="json" class="tab-content">
                    <form class="alert-form" onsubmit="processJsonAlert(event)">
                        <div class="form-group">
                            <label>Alert JSON</label>
                            <textarea id="alertJson" rows="8" placeholder='{"alert_id": "SIEM-001", "source_ip": "185.220.101.46", "type": "Brute Force", "severity": "High"}'></textarea>
                        </div>
                        <button type="submit" class="btn-primary">🚀 Process Alert</button>
                    </form>
                </div>
            </div>
            
            <div class="panel">
                <h2>Execution Logs</h2>
                <div class="log-viewer" id="logViewer">
                    <div class="log-entry info">SOAR Engine initialized and ready...</div>
                </div>
            </div>
        </div>
        
        <div class="main-content" style="margin-top: 30px;">
            <div class="panel">
                <h2>Recent Incidents</h2>
                <div class="incident-list" id="incidentList">
                    <p style="color: #888; text-align: center;">No incidents yet</p>
                </div>
            </div>
            
            <div class="panel">
                <h2>Blocked IPs</h2>
                <div class="blocked-ips" id="blockedIpsList">
                    <p style="color: #888; text-align: center;">No blocked IPs</p>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
    <script>
        const socket = io();
        
        socket.on('connect', function() {
            console.log('Connected to SOAR server');
            addLog('Connected to SOAR server', 'success');
        });
        
        socket.on('soar_update', function(data) {
            updateDashboard();
            loadIncidents();
            loadBlockedIps();
            
            // Add logs
            if (data.logs) {
                data.logs.forEach(log => {
                    const logType = log.includes('MALICIOUS') ? 'danger' : 
                                   log.includes('Block') ? 'warning' :
                                   log.includes('Ticket') ? 'success' : 'info';
                    addLog(log, logType);
                });
            }
        });
        
        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
            document.getElementById(tabName).classList.add('active');
        }
        
        function addLog(message, type = 'info') {
            const logViewer = document.getElementById('logViewer');
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logViewer.insertBefore(entry, logViewer.firstChild);
            
            // Keep only last 100 entries
            while (logViewer.children.length > 100) {
                logViewer.removeChild(logViewer.lastChild);
            }
        }
        
        async function processManualAlert(event) {
            event.preventDefault();
            
            const alertData = {
                alert_id: document.getElementById('alertId').value,
                source_ip: document.getElementById('sourceIp').value,
                type: document.getElementById('attackType').value,
                severity: document.getElementById('severity').value
            };
            
            addLog(`Processing alert: ${alertData.alert_id}`, 'info');
            
            try {
                const response = await fetch('/api/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(alertData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    addLog(`Incident created: ${result.incident_id}`, 'success');
                    addLog(`Decision: ${result.decision}`, result.decision === 'MALICIOUS' ? 'danger' : 'success');
                    
                    result.logs.forEach(log => {
                        addLog(log, log.includes('Block') ? 'warning' : 'info');
                    });
                    
                    updateDashboard();
                    loadIncidents();
                    loadBlockedIps();
                } else {
                    addLog(`Error: ${result.error}`, 'danger');
                }
            } catch (error) {
                addLog(`Error: ${error.message}`, 'danger');
            }
        }
        
        async function processJsonAlert(event) {
            event.preventDefault();
            
            try {
                const alertData = JSON.parse(document.getElementById('alertJson').value);
                
                const response = await fetch('/api/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(alertData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    addLog(`Incident created: ${result.incident_id}`, 'success');
                    result.logs.forEach(log => addLog(log, 'info'));
                    updateDashboard();
                    loadIncidents();
                    loadBlockedIps();
                } else {
                    addLog(`Error: ${result.error}`, 'danger');
                }
            } catch (error) {
                addLog(`Error parsing JSON: ${error.message}`, 'danger');
            }
        }
        
        async function updateDashboard() {
            try {
                const response = await fetch('/api/stats');
                const stats = await response.json();
                
                document.getElementById('incidentsProcessed').textContent = stats.incidents_processed || 0;
                document.getElementById('threatsDetected').textContent = stats.threats_detected || 0;
                document.getElementById('actionsExecuted').textContent = stats.actions_executed || 0;
                document.getElementById('ipsBlocked').textContent = stats.ips_blocked || 0;
            } catch (error) {
                console.error('Failed to update dashboard:', error);
            }
        }
        
        async function loadIncidents() {
            try {
                const response = await fetch('/api/incidents');
                const incidents = await response.json();
                
                const container = document.getElementById('incidentList');
                
                if (incidents.length === 0) {
                    container.innerHTML = '<p style="color: #888; text-align: center;">No incidents yet</p>';
                    return;
                }
                
                container.innerHTML = incidents.slice(0, 10).map(inc => `
                    <div class="incident-item ${inc.decision === 'MALICIOUS' ? 'malicious' : 'clean'}">
                        <div class="incident-header">
                            <span class="incident-id">${inc.incident_id}</span>
                            <span class="incident-status status-${inc.status}">${inc.status}</span>
                        </div>
                        <div style="color: #888; font-size: 0.9em;">
                            <div>IP: ${inc.source_ip || 'N/A'}</div>
                            <div>Type: ${inc.attack_type || 'Unknown'}</div>
                            <div>Decision: ${inc.decision}</div>
                        </div>
                    </div>
                `).join('');
            } catch (error) {
                console.error('Failed to load incidents:', error);
            }
        }
        
        async function loadBlockedIps() {
            try {
                const response = await fetch('/api/blocked-ips');
                const ips = await response.json();
                
                const container = document.getElementById('blockedIpsList');
                
                if (ips.length === 0) {
                    container.innerHTML = '<p style="color: #888; text-align: center;">No blocked IPs</p>';
                    return;
                }
                
                container.innerHTML = ips.map(ip => `
                    <div class="blocked-ip">
                        <span class="blocked-ip-address">${ip.ip_address}</span>
                        <button class="btn-danger" style="padding: 5px 10px; font-size: 0.8em;" onclick="unblockIp('${ip.ip_address}')">Unblock</button>
                    </div>
                `).join('');
            } catch (error) {
                console.error('Failed to load blocked IPs:', error);
            }
        }
        
        async function unblockIp(ip) {
            try {
                const response = await fetch('/api/unblock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip_address: ip })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    addLog(`Unblocked IP: ${ip}`, 'success');
                    loadBlockedIps();
                    updateDashboard();
                } else {
                    addLog(`Failed to unblock IP: ${result.error}`, 'danger');
                }
            } catch (error) {
                addLog(`Error: ${error.message}`, 'danger');
            }
        }
        
        // Initial load
        document.addEventListener('DOMContentLoaded', function() {
            updateDashboard();
            loadIncidents();
            loadBlockedIps();
        });
    </script>
</body>
</html>
'''

# =========================
# Flask Routes
# =========================
@app.route('/')
def index():
    """Serve the main HTML interface"""
    return render_template_string(HTML_TEMPLATE)


@app.route('/api/process', methods=['POST'])
def process_alert():
    """Process an incoming alert"""
    try:
        data = request.get_json(silent=True) or {}
        
        if not data:
            return jsonify({'success': False, 'error': 'No alert data provided'}), 400
        
        result = soar_engine.process_alert(data)
        
        return jsonify({
            'success': True,
            **result
        })
    except Exception as e:
        logger.error(f"Error processing alert: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/stats')
def get_stats():
    """Get SOAR statistics"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        # Count incidents
        cursor.execute("SELECT COUNT(*) FROM incidents")
        total_incidents = cursor.fetchone()[0]
        
        # Count malicious incidents
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE decision = 'MALICIOUS'")
        threats_detected = cursor.fetchone()[0]
        
        # Count actions
        cursor.execute("SELECT COUNT(*) FROM actions")
        total_actions = cursor.fetchone()[0]
        
        # Count blocked IPs
        cursor.execute("SELECT COUNT(*) FROM blocked_ips WHERE active = 1")
        blocked_ips = cursor.fetchone()[0]
        
        conn.close()
        
        return jsonify({
            'incidents_processed': total_incidents,
            'threats_detected': threats_detected,
            'actions_executed': total_actions,
            'ips_blocked': blocked_ips,
            'system_status': 'online'
        })
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return jsonify({
            'incidents_processed': soar_engine.incidents_processed,
            'threats_detected': 0,
            'actions_executed': soar_engine.actions_executed,
            'ips_blocked': 0,
            'system_status': 'online'
        })


@app.route('/api/incidents')
def get_incidents():
    """Get recent incidents"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute('''
            SELECT incident_id, alert_id, source_ip, attack_type, severity, status, decision, created_at
            FROM incidents ORDER BY created_at DESC LIMIT 50
        ''')
        rows = cursor.fetchall()
        conn.close()
        
        incidents = [{
            'incident_id': row[0],
            'alert_id': row[1],
            'source_ip': row[2],
            'attack_type': row[3],
            'severity': row[4],
            'status': row[5],
            'decision': row[6],
            'created_at': row[7]
        } for row in rows]
        
        return jsonify(incidents)
    except Exception as e:
        logger.error(f"Error getting incidents: {e}")
        return jsonify([])


@app.route('/api/incidents/<incident_id>')
def get_incident(incident_id):
    """Get a specific incident with its actions"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        # Get incident
        cursor.execute("SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'success': False, 'error': 'Incident not found'}), 404
        
        # Get actions
        cursor.execute("SELECT * FROM actions WHERE incident_id = ?", (incident_id,))
        action_rows = cursor.fetchall()
        
        conn.close()
        
        return jsonify({
            'incident_id': row[1],
            'alert_id': row[2],
            'source_ip': row[3],
            'attack_type': row[4],
            'severity': row[5],
            'status': row[6],
            'decision': row[7],
            'created_at': row[8],
            'updated_at': row[9],
            'resolved_at': row[10],
            'metadata': json.loads(row[11]) if row[11] else {},
            'actions': [{
                'action_type': a[2],
                'action_detail': a[3],
                'status': a[4],
                'result': a[5],
                'executed_at': a[6]
            } for a in action_rows]
        })
    except Exception as e:
        logger.error(f"Error getting incident: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/incidents/<incident_id>/status', methods=['POST'])
def update_incident_status(incident_id):
    """Update incident status"""
    try:
        data = request.get_json(silent=True) or {}
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({'success': False, 'error': 'Status is required'}), 400
        
        soar_engine._update_incident_status(incident_id, new_status)
        
        return jsonify({
            'success': True,
            'message': f'Incident {incident_id} status updated to {new_status}'
        })
    except Exception as e:
        logger.error(f"Error updating incident status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/blocked-ips')
def get_blocked_ips():
    """Get list of blocked IPs"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute('''
            SELECT ip_address, reason, incident_id, blocked_at, expires_at
            FROM blocked_ips WHERE active = 1 ORDER BY blocked_at DESC
        ''')
        rows = cursor.fetchall()
        conn.close()
        
        ips = [{
            'ip_address': row[0],
            'reason': row[1],
            'incident_id': row[2],
            'blocked_at': row[3],
            'expires_at': row[4]
        } for row in rows]
        
        return jsonify(ips)
    except Exception as e:
        logger.error(f"Error getting blocked IPs: {e}")
        return jsonify([])


@app.route('/api/block', methods=['POST'])
def api_block_ip():
    """Manually block an IP"""
    try:
        data = request.get_json(silent=True) or {}
        ip = data.get('ip_address')
        reason = data.get('reason', 'Manual block')
        duration = data.get('duration_hours', 24)
        
        if not ip:
            return jsonify({'success': False, 'error': 'IP address is required'}), 400
        
        success, msg = block_ip(ip, None, reason, duration)
        
        return jsonify({
            'success': success,
            'message': msg
        })
    except Exception as e:
        logger.error(f"Error blocking IP: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/unblock', methods=['POST'])
def api_unblock_ip():
    """Unblock an IP"""
    try:
        data = request.get_json(silent=True) or {}
        ip = data.get('ip_address')
        
        if not ip:
            return jsonify({'success': False, 'error': 'IP address is required'}), 400
        
        success, msg = unblock_ip(ip)
        
        return jsonify({
            'success': success,
            'message': msg
        })
    except Exception as e:
        logger.error(f"Error unblocking IP: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/playbooks')
def get_playbooks():
    """Get all playbooks"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM playbooks ORDER BY name")
        rows = cursor.fetchall()
        conn.close()
        
        playbooks = [{
            'id': row[0],
            'name': row[1],
            'description': row[2],
            'trigger_conditions': json.loads(row[3]) if row[3] else {},
            'actions': json.loads(row[4]) if row[4] else [],
            'enabled': bool(row[5]),
            'created_at': row[6]
        } for row in rows]
        
        return jsonify(playbooks)
    except Exception as e:
        logger.error(f"Error getting playbooks: {e}")
        return jsonify([])


@app.route('/api/playbooks', methods=['POST'])
def create_playbook():
    """Create a new playbook"""
    try:
        data = request.get_json(silent=True) or {}
        
        name = data.get('name')
        if not name:
            return jsonify({'success': False, 'error': 'Playbook name is required'}), 400
        
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO playbooks (name, description, trigger_conditions, actions, enabled)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            name,
            data.get('description', ''),
            json.dumps(data.get('trigger_conditions', {})),
            json.dumps(data.get('actions', [])),
            1 if data.get('enabled', True) else 0
        ))
        conn.commit()
        playbook_id = cursor.lastrowid
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Playbook created successfully',
            'playbook_id': playbook_id
        })
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Playbook with this name already exists'}), 400
    except Exception as e:
        logger.error(f"Error creating playbook: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/playbooks/<int:playbook_id>', methods=['PUT'])
def update_playbook(playbook_id):
    """Update a playbook"""
    try:
        data = request.get_json(silent=True) or {}
        
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        updates = []
        params = []
        
        if 'name' in data:
            updates.append("name = ?")
            params.append(data['name'])
        if 'description' in data:
            updates.append("description = ?")
            params.append(data['description'])
        if 'trigger_conditions' in data:
            updates.append("trigger_conditions = ?")
            params.append(json.dumps(data['trigger_conditions']))
        if 'actions' in data:
            updates.append("actions = ?")
            params.append(json.dumps(data['actions']))
        if 'enabled' in data:
            updates.append("enabled = ?")
            params.append(1 if data['enabled'] else 0)
        
        if updates:
            params.append(playbook_id)
            cursor.execute(f"UPDATE playbooks SET {', '.join(updates)} WHERE id = ?", params)
            conn.commit()
        
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Playbook updated successfully'
        })
    except Exception as e:
        logger.error(f"Error updating playbook: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/playbooks/<int:playbook_id>', methods=['DELETE'])
def delete_playbook(playbook_id):
    """Delete a playbook"""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute("DELETE FROM playbooks WHERE id = ?", (playbook_id,))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Playbook deleted successfully'
        })
    except Exception as e:
        logger.error(f"Error deleting playbook: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/threat-intel/check', methods=['POST'])
def check_threat_intel():
    """Check IP or payload against threat intelligence"""
    try:
        data = request.get_json(silent=True) or {}
        ip = data.get('ip')
        payload = data.get('payload')
        
        results = {}
        
        if ip:
            is_malicious, reason = check_ip_reputation(ip)
            results['ip'] = {
                'value': ip,
                'is_malicious': is_malicious,
                'reason': reason
            }
        
        if payload:
            is_malicious, reason = check_payload_patterns(payload)
            results['payload'] = {
                'is_malicious': is_malicious,
                'reason': reason
            }
        
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        logger.error(f"Error checking threat intel: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'soar',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/logs')
def get_execution_logs():
    """Get recent execution logs"""
    return jsonify(list(execution_logs)[-100:])


# =========================
# WebSocket Events
# =========================
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to SOAR server'})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {request.sid}")


if __name__ == '__main__':
    logger.info("Starting SOAR Automation Platform...")
    logger.info(f"Data directory: {DATA_DIR}")
    logger.info(f"Database path: {DB_PATH}")
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)

