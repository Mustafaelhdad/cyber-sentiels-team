#!/usr/bin/env python3
"""
Simple SIEM Tool with File Upload and Alerting System
Author: SimpleSIEM
Version: 1.0.0
"""

import os
import re
import json
import time
import threading
import csv
import pickle
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict, deque
from flask import Flask, request, render_template_string, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/siem.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('SIEM-Tool')

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SIEM_SECRET_KEY', 'your-secret-key-here-change-in-production')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Use gevent for production, threading for development
async_mode = os.environ.get('SIEM_ASYNC_MODE', 'gevent')
socketio = SocketIO(app, async_mode=async_mode, cors_allowed_origins="*")

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / app.config['UPLOAD_FOLDER']
LOG_DIR = BASE_DIR / 'logs'
REPORT_DIR = BASE_DIR / 'reports'

# Create necessary directories
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)

# Load detection rules
with open(BASE_DIR / 'rules.json', 'r') as f:
    RULES = json.load(f)['rules']

# In-memory storage for alerts and logs
alerts = []
log_entries = []
event_store = defaultdict(deque)
alert_history = []
analysis_runs = deque(maxlen=50)

# HTML Template for Web Interface
HTML_TEMPLATE = r'''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple SIEM Tool</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 5px;
        }
        .upload-form {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        input[type="file"], input[type="text"] {
            padding: 10px;
            flex: 1;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }
        button:hover {
            background-color: #45a049;
        }
        .alerts {
            margin-top: 20px;
        }
        .alert {
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 5px solid;
        }
        .alert-critical {
            background-color: #ffebee;
            border-color: #f44336;
        }
        .alert-high {
            background-color: #fff3e0;
            border-color: #ff9800;
        }
        .alert-medium {
            background-color: #fffde7;
            border-color: #ffeb3b;
        }
        .alert-low {
            background-color: #e8f5e9;
            border-color: #4caf50;
        }
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .dashboard-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            text-align: center;
        }
        .dashboard-card h3 {
            margin: 0;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
        }
        .dashboard-card .value {
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
            color: #333;
        }
        .log-viewer {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            max-height: 400px;
            overflow-y: auto;
            white-space: pre-wrap;
            margin-top: 10px;
        }
        .tab-container {
            display: flex;
            border-bottom: 1px solid #ddd;
            margin-bottom: 20px;
        }
        .tab {
            padding: 10px 20px;
            cursor: pointer;
            border: 1px solid transparent;
            border-bottom: none;
            background: none;
        }
        .tab.active {
            background: white;
            border-color: #ddd;
            border-bottom-color: white;
            margin-bottom: -1px;
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
            margin-right: 5px;
        }
        .status-online {
            background-color: #4CAF50;
        }
        .status-offline {
            background-color: #f44336;
        }
        .inline-option {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 10px;
            color: #555;
            font-size: 14px;
        }
        #realtimeStatus {
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Simple SIEM Tool</h1>
        
        <div class="dashboard">
            <div class="dashboard-card">
                <h3>Total Logs Processed</h3>
                <div class="value" id="totalLogs">0</div>
            </div>
            <div class="dashboard-card">
                <h3>Active Alerts</h3>
                <div class="value" id="activeAlerts">0</div>
            </div>
            <div class="dashboard-card">
                <h3>High Severity</h3>
                <div class="value" id="highAlerts">0</div>
            </div>
            <div class="dashboard-card">
                <h3>System Status</h3>
                <div class="value">
                    <span class="status-indicator status-online"></span>
                    <span id="systemStatus">ONLINE</span>
                </div>
            </div>
        </div>
        
        <div class="tab-container">
            <div class="tab active" data-tab="upload" onclick="switchTab('upload', this)">Upload Logs</div>
            <div class="tab" data-tab="alerts" onclick="switchTab('alerts', this)">Alerts</div>
            <div class="tab" data-tab="logs" onclick="switchTab('logs', this)">Log Viewer</div>
            <div class="tab" data-tab="rules" onclick="switchTab('rules', this)">Rules</div>
            <div class="tab" data-tab="realtime" onclick="switchTab('realtime', this)">Real-time</div>
        </div>
        
        <!-- Upload Tab -->
        <div id="upload" class="tab-content active">
            <div class="section">
                <h2>Upload Log File for Analysis</h2>
                <div class="upload-form">
                    <input type="file" id="logFile">
                    <input type="text" id="logSource" placeholder="Source (e.g., firewall, server)" value="firewall">
                    <button onclick="uploadLog()">Upload & Analyze</button>
                </div>
                <div id="uploadStatus"></div>
            </div>
            
            <div class="section">
                <h2>Or Enter Log Manually</h2>
                <textarea id="manualLog" rows="5" style="width: 100%; padding: 10px;" 
                          placeholder="Enter log entries (one per line) or paste log content here..."></textarea>
                <input type="text" id="manualSource" placeholder="Source" value="manual" style="margin-top: 10px; padding: 10px; width: 200px;">
                <button onclick="analyzeManualLog()" style="margin-top: 10px;">Analyze Manual Log</button>
                <div id="manualStatus"></div>
            </div>
        </div>
        
        <!-- Alerts Tab -->
        <div id="alerts" class="tab-content">
            <div class="section">
                <h2>Security Alerts</h2>
                <div id="alertsContainer" class="alerts">
                    <!-- Alerts will be populated here -->
                </div>
            </div>
        </div>
        
        <!-- Log Viewer Tab -->
        <div id="logs" class="tab-content">
            <div class="section">
                <h2>Log Viewer</h2>
                <div class="log-viewer" id="logViewer">
                    <!-- Logs will be displayed here -->
                </div>
            </div>
        </div>
        
        <!-- Rules Tab -->
        <div id="rules" class="tab-content">
            <div class="section">
                <h2>Detection Rules</h2>
                <div id="rulesContainer">
                    <!-- Rules will be populated here -->
                </div>
            </div>
        </div>
        
        <!-- Real-time Tab -->
        <div id="realtime" class="tab-content">
            <div class="section">
                <h2>Real-time Log Monitoring</h2>
                <div class="upload-form">
                    <input type="text" id="realtimeFile" placeholder="Path to log file (server path)">
                    <input type="text" id="realtimeSource" placeholder="Source for real-time logs" value="realtime">
                    <button onclick="startRealtime()">Start Real-time</button>
                    <button onclick="stopRealtime()" style="background-color: #f44336;">Stop Real-time</button>
                </div>
                <div class="inline-option">
                    <input type="checkbox" id="realtimeFromStart">
                    <label for="realtimeFromStart">Analyze existing content</label>
                </div>
                <div id="realtimeStatus"></div>
                <div class="log-viewer" id="realtimeLogs">
                    <!-- Real-time logs will appear here -->
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
    <script>
        const socket = io();
        let realtimeEnabled = false;
        
        // Socket event handlers
        socket.on('connect', function() {
            console.log('Connected to SIEM server');
            document.getElementById('systemStatus').textContent = 'ONLINE';
        });
        
        socket.on('alert', function(data) {
            addAlertToUI(data);
            updateDashboard();
            playAlertSound();
        });
        
        socket.on('log_update', function(data) {
            updateLogViewer(data.logs);
            updateDashboard(data.stats);
        });

        socket.on('realtime_status', function(data) {
            const statusDiv = document.getElementById('realtimeStatus');
            if (!statusDiv) {
                return;
            }
            if (data.success) {
                statusDiv.innerHTML = '<div class="alert alert-low">Real-time monitoring active.</div>';
            } else {
                statusDiv.innerHTML = '<div class="alert alert-high">Error: ' + data.error + '</div>';
                realtimeEnabled = false;
            }
        });
        
        socket.on('realtime_log', function(data) {
            if (realtimeEnabled) {
                const realtimeLogs = document.getElementById('realtimeLogs');
                realtimeLogs.innerHTML = data.log + '\n' + realtimeLogs.innerHTML;
            }
        });
        
        function switchTab(tabName, tabElement) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName).classList.add('active');
            const activeTab = tabElement || document.querySelector(`.tab[data-tab="${tabName}"]`);
            if (activeTab) {
                activeTab.classList.add('active');
            }
        }
        
        function uploadLog() {
            const fileInput = document.getElementById('logFile');
            const sourceInput = document.getElementById('logSource');
            const statusDiv = document.getElementById('uploadStatus');
            
            if (!fileInput.files[0]) {
                statusDiv.innerHTML = '<div class="alert alert-medium">Please select a file first!</div>';
                return;
            }
            
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('source', sourceInput.value);
            
            statusDiv.innerHTML = '<div class="alert alert-low">Uploading and analyzing file...</div>';
            
            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    statusDiv.innerHTML = '<div class="alert alert-low">✅ File uploaded successfully! Processed ' + data.logs_processed + ' logs, found ' + data.alerts_generated + ' alerts.</div>';
                    loadAlerts();
                    loadLogs();
                    if (data.stats) {
                        updateDashboard(data.stats);
                    }
                    if (data.report_url) {
                        showReportLink('uploadStatus', data.report_url, true);
                    }
                } else {
                    statusDiv.innerHTML = '<div class="alert alert-high">❌ Error: ' + data.error + '</div>';
                }
            })
            .catch(error => {
                statusDiv.innerHTML = '<div class="alert alert-high">❌ Error: ' + error + '</div>';
            });
        }
        
        function analyzeManualLog() {
            const manualLog = document.getElementById('manualLog').value;
            const source = document.getElementById('manualSource').value;
            
            if (!manualLog.trim()) {
                alert('Please enter some log content!');
                return;
            }
            
            fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    logs: manualLog,
                    source: source
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('✅ Analysis complete! Processed ' + data.logs_processed + ' logs, found ' + data.alerts_generated + ' alerts.');
                    loadAlerts();
                    loadLogs();
                    if (data.stats) {
                        updateDashboard(data.stats);
                    }
                    if (data.report_url) {
                        showReportLink('manualStatus', data.report_url, false);
                    }
                } else {
                    alert('❌ Error: ' + data.error);
                }
            });
        }

        function formatTipInfo(alert) {
            if (!alert.tip || !alert.tip.label) {
                return '';
            }
            const confidence = alert.tip.confidence !== undefined && alert.tip.confidence !== null
                ? ` (${Math.round(alert.tip.confidence * 100)}%)`
                : '';
            return `<br><small>TIP: ${alert.tip.label}${confidence}</small>`;
        }

        function showReportLink(containerId, reportUrl, append) {
            const container = document.getElementById(containerId);
            if (!container || !reportUrl) {
                return;
            }
            const linkHtml = `<div class="alert alert-low">Report ready: <a href="${reportUrl}" target="_blank" rel="noopener">Open HTML summary</a></div>`;
            container.innerHTML = append ? container.innerHTML + linkHtml : linkHtml;
        }
        
        function loadAlerts() {
            fetch('/alerts')
            .then(response => response.json())
            .then(alerts => {
                const container = document.getElementById('alertsContainer');
                container.innerHTML = '';
                
                alerts.forEach(alert => {
                    const severityClass = 'alert-' + alert.severity.toLowerCase();
                    const alertElement = document.createElement('div');
                    alertElement.className = 'alert ' + severityClass;
                    alertElement.innerHTML = 
                        '<strong>' + alert.rule_name + '</strong> (' + alert.severity + ')<br>' +
                        '<small>' + new Date(alert.timestamp).toLocaleString() + '</small><br>' +
                        alert.description + '<br>' +
                        '<small>Source: ' + alert.source + ' | Log: ' + alert.log_entry.substring(0, 100) + '...</small>' +
                        formatTipInfo(alert);
                    container.appendChild(alertElement);
                });
            });
        }
        
        function loadLogs() {
            fetch('/logs')
            .then(response => response.json())
            .then(logs => {
                const viewer = document.getElementById('logViewer');
                viewer.textContent = logs.slice(-50).join('\n');
            });
        }
        
        function loadRules() {
            fetch('/rules')
            .then(response => response.json())
            .then(rules => {
                const container = document.getElementById('rulesContainer');
                container.innerHTML = '';
                
                rules.forEach(rule => {
                    const ruleElement = document.createElement('div');
                    ruleElement.className = 'alert alert-low';
                    ruleElement.innerHTML = 
                        '<strong>' + rule.name + '</strong> (' + rule.id + ')<br>' +
                        '<small>Severity: ' + rule.severity + '</small><br>' +
                        rule.description + '<br>' +
                        '<small>Pattern: ' + rule.pattern + '</small>';
                    container.appendChild(ruleElement);
                });
            });
        }
        
        function addAlertToUI(alert) {
            const container = document.getElementById('alertsContainer');
            const severityClass = 'alert-' + alert.severity.toLowerCase();
            const alertElement = document.createElement('div');
            alertElement.className = 'alert ' + severityClass;
            alertElement.innerHTML = 
                '<strong>' + alert.rule_name + '</strong> (' + alert.severity + ')<br>' +
                '<small>' + new Date(alert.timestamp).toLocaleString() + '</small><br>' +
                alert.description + '<br>' +
                '<small>Source: ' + alert.source + ' | Log: ' + alert.log_entry.substring(0, 100) + '...</small>' +
                formatTipInfo(alert);
            
            // Add to top
            if (container.firstChild) {
                container.insertBefore(alertElement, container.firstChild);
            } else {
                container.appendChild(alertElement);
            }
        }
        
        function updateLogViewer(logs) {
            const viewer = document.getElementById('logViewer');
            viewer.textContent = logs.slice(-50).join('\n');
        }
        
        function updateDashboard(stats) {
            if (!stats) {
                loadStats();
                return;
            }
            document.getElementById('totalLogs').textContent = stats.total_logs_processed ?? 0;
            document.getElementById('activeAlerts').textContent = stats.total_alerts ?? 0;
            document.getElementById('highAlerts').textContent = stats.high_severity_alerts ?? 0;
            document.getElementById('systemStatus').textContent =
                stats.system_status ? stats.system_status.toUpperCase() : 'ONLINE';
        }

        function loadStats() {
            fetch('/stats')
            .then(response => response.json())
            .then(stats => {
                updateDashboard(stats);
            });
        }
        
        function playAlertSound() {
            // Play a subtle alert sound
            const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ');
            audio.volume = 0.3;
            audio.play().catch(e => console.log('Audio play failed:', e));
        }
        
        function startRealtime() {
            const filePath = document.getElementById('realtimeFile').value;
            const source = document.getElementById('realtimeSource').value;
            const fromStart = document.getElementById('realtimeFromStart').checked;
            const statusDiv = document.getElementById('realtimeStatus');

            if (!filePath.trim()) {
                statusDiv.innerHTML = '<div class="alert alert-medium">Please provide a log file path.</div>';
                return;
            }

            realtimeEnabled = true;
            socket.emit('start_realtime', { source: source, file_path: filePath, from_start: fromStart });
            document.getElementById('realtimeLogs').innerHTML = 'Real-time monitoring started...\n';
        }
        
        function stopRealtime() {
            realtimeEnabled = false;
            socket.emit('stop_realtime');
            document.getElementById('realtimeLogs').innerHTML += 'Real-time monitoring stopped.\n';
        }
        
        // Initial load
        document.addEventListener('DOMContentLoaded', function() {
            loadAlerts();
            loadLogs();
            loadRules();
            loadStats();
            switchTab('upload'); // Ensure upload tab is active on load
        });
    </script>
</body>
</html>
'''

REPORT_TEMPLATE = r'''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SIEM Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
        }
        .meta {
            color: #666;
            font-size: 14px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
            margin: 20px 0;
        }
        .summary-card {
            background: #f9f9f9;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #eee;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            text-align: left;
            padding: 8px;
            border-bottom: 1px solid #eee;
            vertical-align: top;
        }
        th {
            background: #fafafa;
            font-size: 13px;
            text-transform: uppercase;
            color: #666;
        }
        .empty {
            color: #888;
            font-style: italic;
            padding: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>SIEM Report</h1>
        <p class="meta">Generated: {{ generated_at }}</p>

        <div class="summary-grid">
            <div class="summary-card"><strong>Run ID:</strong> {{ run.id }}</div>
            <div class="summary-card"><strong>Run Type:</strong> {{ run.type }}</div>
            <div class="summary-card"><strong>Source:</strong> {{ run.source }}</div>
            <div class="summary-card"><strong>Logs Processed:</strong> {{ run.logs_processed }}</div>
            <div class="summary-card"><strong>Alerts Generated:</strong> {{ run.alerts_generated }}</div>
            <div class="summary-card"><strong>Rules Loaded:</strong> {{ rules_count }}</div>
        </div>

        <h2>Alert Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>Severity</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody>
                {% for row in severity_rows %}
                <tr>
                    <td>{{ row.severity }}</td>
                    <td>{{ row.count }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>

        <h2>Alerts</h2>
        {% if alerts %}
        <table>
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Severity</th>
                    <th>Rule</th>
                    <th>Description</th>
                    <th>Source</th>
                    <th>Log Entry</th>
                    <th>TIP</th>
                </tr>
            </thead>
            <tbody>
                {% for alert in alerts %}
                <tr>
                    <td>{{ alert.timestamp }}</td>
                    <td>{{ alert.severity }}</td>
                    <td>{{ alert.rule_name }}</td>
                    <td>{{ alert.description }}</td>
                    <td>{{ alert.source }}</td>
                    <td>{{ alert.log_entry }}</td>
                    <td>{{ alert.tip_label }}{% if alert.tip_confidence %} ({{ alert.tip_confidence }}){% endif %}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
        {% else %}
        <div class="empty">No alerts were generated for this run.</div>
        {% endif %}
    </div>
</body>
</html>
'''

TIP_FEATURES = [
    "Destination Port",
    "Flow Duration",
    "Total Fwd Packets",
    "Total Length of Fwd Packets",
    "Fwd Packet Length Max",
    "Fwd Packet Length Min",
    "Fwd Packet Length Mean",
    "Fwd Packet Length Std",
    "Bwd Packet Length Max",
    "Bwd Packet Length Min",
    "Bwd Packet Length Mean",
    "Bwd Packet Length Std",
    "Flow Bytes/s",
    "Flow Packets/s",
    "Flow IAT Mean",
    "Flow IAT Std",
    "Flow IAT Max",
    "Flow IAT Min",
    "Fwd IAT Total",
    "Fwd IAT Mean",
    "Fwd IAT Std",
    "Fwd IAT Max",
    "Fwd IAT Min",
    "Bwd IAT Total",
    "Bwd IAT Mean",
    "Bwd IAT Std",
    "Bwd IAT Max",
    "Bwd IAT Min",
    "Fwd Header Length",
    "Bwd Header Length",
    "Fwd Packets/s",
    "Bwd Packets/s",
    "Min Packet Length",
    "Max Packet Length",
    "Packet Length Mean",
    "Packet Length Std",
    "Packet Length Variance",
    "FIN Flag Count",
    "PSH Flag Count",
    "ACK Flag Count",
    "Average Packet Size",
    "Subflow Fwd Bytes",
    "Init_Win_bytes_forward",
    "Init_Win_bytes_backward",
    "act_data_pkt_fwd",
    "min_seg_size_forward",
    "Active Mean",
    "Active Max",
    "Active Min",
    "Idle Mean",
    "Idle Max",
    "Idle Min"
]

TIP_BENIGN_LABELS = {"BENIGN", "NORMAL", "NORMAL_TRAFFIC"}


def _normalize_feature_key(value):
    return re.sub(r'[^a-z0-9]', '', str(value).lower())


class TIPModel:
    """Optional TIP model integration for structured flow features."""

    def __init__(self, model_dir=None):
        self.available = False
        if model_dir is None:
            model_dir = os.environ.get('SIEM_TIP_MODEL_DIR') or (BASE_DIR / '..' / 'TIP_Model' / 'model')
        self.model_dir = Path(model_dir)
        self.model_dir = self.model_dir.resolve()
        self.feature_names = TIP_FEATURES
        self._feature_map = {
            _normalize_feature_key(name): name for name in self.feature_names
        }
        self._model = None
        self._scaler = None
        self._label_encoder = None
        self._np = None
        self._load()

    def _load(self):
        if os.environ.get('SIEM_TIP_ENABLED', 'true').lower() not in {'1', 'true', 'yes'}:
            logger.info("TIP model disabled via SIEM_TIP_ENABLED.")
            return
        try:
            import numpy as np
            from tensorflow.keras.models import load_model
        except Exception as exc:
            logger.info("TIP model unavailable (missing dependencies): %s", exc)
            return

        model_path = self.model_dir / 'cicids2017_model.h5'
        scaler_path = self.model_dir / 'scaler.pkl'
        label_path = self.model_dir / 'label_encoder.pkl'

        if not model_path.exists() or not scaler_path.exists() or not label_path.exists():
            logger.info("TIP model files not found in %s", self.model_dir)
            return

        try:
            self._model = load_model(model_path)
            with open(scaler_path, 'rb') as f:
                self._scaler = pickle.load(f)
            with open(label_path, 'rb') as f:
                self._label_encoder = pickle.load(f)
            self._np = np
            self.available = True
            logger.info("TIP model loaded from %s", self.model_dir)
        except Exception as exc:
            logger.error("Failed to load TIP model: %s", exc)

    def _extract_features(self, payload):
        normalized = {}
        for key, value in payload.items():
            canonical = self._feature_map.get(_normalize_feature_key(key))
            if not canonical:
                continue
            try:
                normalized[canonical] = float(value)
            except (TypeError, ValueError):
                continue

        missing = [name for name in self.feature_names if name not in normalized]
        if missing:
            return None, missing
        return normalized, None

    def _parse_payload(self, log_line):
        line = log_line.strip()
        if not line or line[0] not in '{[':
            return None
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            return None

        if isinstance(payload, dict) and isinstance(payload.get('features'), dict):
            return payload['features']
        if isinstance(payload, dict):
            return payload
        return None

    def predict_from_log_line(self, log_line):
        payload = self._parse_payload(log_line)
        if not payload:
            return None
        return self.predict(payload)

    def predict(self, payload):
        if not self.available:
            return None

        features, missing = self._extract_features(payload)
        if missing:
            return None

        values = [features[name] for name in self.feature_names]
        scaled = self._scaler.transform([values])
        probs = self._model.predict(scaled, verbose=0)
        probs = self._np.asarray(probs).reshape(1, -1)
        predicted_index = int(self._np.argmax(probs, axis=1)[0])
        label = str(self._label_encoder.inverse_transform([predicted_index])[0])
        confidence = float(self._np.max(probs))
        is_malicious = label.upper() not in TIP_BENIGN_LABELS

        return {
            'label': label,
            'confidence': confidence,
            'is_malicious': is_malicious
        }


TIP_MODEL = TIPModel()


def _escape_html(value):
    text = '' if value is None else str(value)
    return (text.replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
                .replace('"', '&quot;')
                .replace("'", '&#39;'))


def _prepare_report_alerts(alerts_list):
    rows = []
    for alert in alerts_list:
        tip = alert.get('tip') or {}
        tip_label = tip.get('label') if isinstance(tip, dict) else None
        tip_confidence = tip.get('confidence') if isinstance(tip, dict) else None
        if isinstance(tip_confidence, (int, float)):
            tip_confidence = f"{tip_confidence * 100:.1f}%"
        else:
            tip_confidence = ''

        rows.append({
            'timestamp': _escape_html(alert.get('timestamp', '')),
            'severity': _escape_html(alert.get('severity', '')),
            'rule_name': _escape_html(alert.get('rule_name', '')),
            'description': _escape_html(alert.get('description', '')),
            'source': _escape_html(alert.get('source', '')),
            'log_entry': _escape_html(alert.get('log_entry', '')),
            'tip_label': _escape_html(tip_label) if tip_label else '',
            'tip_confidence': tip_confidence
        })
    return rows


def _build_severity_rows(alerts_list):
    counts = defaultdict(int)
    for alert in alerts_list:
        severity = str(alert.get('severity', 'UNKNOWN')).upper()
        counts[severity] += 1

    ordered = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']
    rows = []
    for severity in ordered:
        rows.append({
            'severity': severity,
            'count': counts.get(severity, 0)
        })
    return rows


def _create_report(run, alerts_list):
    report_name = f"siem_report_{run['id']}.html"
    report_path = REPORT_DIR / report_name
    alert_rows = _prepare_report_alerts(alerts_list)
    severity_rows = _build_severity_rows(alerts_list)
    generated_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    html = render_template_string(
        REPORT_TEMPLATE,
        run=run,
        alerts=alert_rows,
        severity_rows=severity_rows,
        generated_at=generated_at,
        rules_count=len(RULES)
    )
    report_path.write_text(html, encoding='utf-8')
    return report_name


def _register_run(run_type, source, logs_processed, alerts_list, filename=None):
    run_id = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    run = {
        'id': run_id,
        'type': run_type,
        'source': source,
        'logs_processed': logs_processed,
        'alerts_generated': len(alerts_list),
        'filename': filename or ''
    }
    report_name = _create_report(run, alerts_list)
    run['report_filename'] = report_name
    analysis_runs.append(run)
    return run


def _build_realtime_roots():
    roots = [UPLOAD_DIR, LOG_DIR]
    extra_roots = os.environ.get('SIEM_REALTIME_ROOTS', '')
    for entry in extra_roots.split(os.pathsep):
        entry = entry.strip()
        if entry:
            roots.append(Path(entry))
    return [root.resolve() for root in roots]


def _is_within_path(path, root):
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


REALTIME_ALLOWED_ROOTS = _build_realtime_roots()
REALTIME_POLL_INTERVAL = float(os.environ.get('SIEM_REALTIME_POLL_INTERVAL', '0.5'))
realtime_monitors = {}
realtime_lock = threading.Lock()


def _resolve_realtime_path(raw_path):
    if not raw_path:
        return None, 'Log file path is required.'

    candidate = Path(raw_path).expanduser()
    if not candidate.is_absolute():
        candidate = (BASE_DIR / raw_path).resolve()
        if not candidate.exists():
            candidate = (UPLOAD_DIR / raw_path).resolve()
        if not candidate.exists():
            candidate = (LOG_DIR / raw_path).resolve()
    else:
        candidate = candidate.resolve()

    if not candidate.exists() or not candidate.is_file():
        return None, f'Log file not found: {raw_path}'

    if not any(_is_within_path(candidate, root) for root in REALTIME_ALLOWED_ROOTS):
        return None, 'Log file is outside allowed directories.'

    return candidate, None


def _current_stats():
    return {
        'total_logs_processed': len(log_entries),
        'total_alerts': len(alerts),
        'high_severity_alerts': len([a for a in alerts if a['severity'] == 'HIGH']),
        'critical_alerts': len([a for a in alerts if a['severity'] == 'CRITICAL']),
        'system_status': 'online'
    }


def _stop_realtime_monitor(client_id):
    with realtime_lock:
        monitor = realtime_monitors.pop(client_id, None)
    if monitor:
        monitor['stop_event'].set()


def _tail_realtime_file(client_id, file_path, source, from_start, stop_event):
    analyzer = SIEMAnalyzer(tip_model=TIP_MODEL)
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            if not from_start:
                f.seek(0, os.SEEK_END)

            while not stop_event.is_set():
                line = f.readline()
                if not line:
                    try:
                        if os.path.getsize(file_path) < f.tell():
                            f.seek(0, os.SEEK_END)
                    except OSError:
                        pass
                    stop_event.wait(REALTIME_POLL_INTERVAL)
                    continue

                analyzer.analyze_log_line(line, source)
                socketio.emit(
                    'realtime_log',
                    {'log': f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {source}: {line.strip()}"},
                    to=client_id
                )
                socketio.emit('log_update', {'logs': log_entries[-50:], 'stats': _current_stats()})
    except Exception as exc:
        logger.error("Real-time monitor error: %s", exc)
        socketio.emit('realtime_status', {'success': False, 'error': str(exc)}, to=client_id)


def _start_realtime_monitor(client_id, file_path, source, from_start):
    _stop_realtime_monitor(client_id)
    stop_event = threading.Event()
    thread = threading.Thread(
        target=_tail_realtime_file,
        args=(client_id, file_path, source, from_start, stop_event),
        daemon=True
    )
    with realtime_lock:
        realtime_monitors[client_id] = {
            'stop_event': stop_event,
            'thread': thread,
            'file_path': str(file_path)
        }
    thread.start()


class SIEMAnalyzer:
    """Core SIEM analysis engine"""
    
    def __init__(self, tip_model=None):
        self.logs_processed = 0
        self.alerts_generated = 0
        self.tip_model = tip_model if tip_model is not None else TIP_MODEL
        
    def analyze_log_line(self, log_line, source="unknown"):
        """Analyze a single log line for security threats"""
        log_line = log_line.strip()
        if not log_line:
            return None
            
        self.logs_processed += 1
        log_entries.append(f"[{datetime.now()}] {source}: {log_line}")
        
        detected_alerts = []
        tip_result = self._evaluate_tip(log_line)
        
        for rule in RULES:
            if self._check_rule(rule, log_line, source):
                alert = self._create_alert(rule, log_line, source, tip_result)
                detected_alerts.append(alert)

        if not detected_alerts and tip_result and tip_result.get('is_malicious'):
            detected_alerts.append(self._create_tip_alert(log_line, source, tip_result))

        return detected_alerts
    
    def _check_rule(self, rule, log_line, source):
        """Check if a log line matches a detection rule"""
        try:
            # Check for pattern match
            if re.search(rule['pattern'], log_line, re.IGNORECASE):
                
                # For threshold-based rules, check time window
                if 'threshold' in rule and 'time_window' in rule:
                    rule_id = rule['id']
                    current_time = time.time()
                    window_start = current_time - rule['time_window']
                    event_store[rule_id].append((current_time, log_line))
                    
                    # Remove old events
                    while (event_store[rule_id] and 
                           event_store[rule_id][0][0] < window_start):
                        event_store[rule_id].popleft()
                    
                    # Check threshold
                    if len(event_store[rule_id]) >= rule['threshold']:
                        return True
                    if rule.get('alert_on_match'):
                        return True
                    return False
                
                return True
        except Exception as e:
            logger.error(f"Error checking rule {rule['id']}: {e}")
        
        return False

    def _evaluate_tip(self, log_line):
        if not self.tip_model or not self.tip_model.available:
            return None
        try:
            return self.tip_model.predict_from_log_line(log_line)
        except Exception as exc:
            logger.error("TIP evaluation error: %s", exc)
            return None

    def _create_tip_alert(self, log_line, source, tip_result):
        alert = {
            'id': f"ALERT-{len(alerts)+1:06d}",
            'timestamp': datetime.now().isoformat(),
            'rule_id': 'TIP-MODEL',
            'rule_name': 'TIP Model',
            'severity': 'HIGH',
            'description': f"TIP model classified this event as {tip_result.get('label', 'Unknown')}",
            'log_entry': log_line,
            'source': source,
            'acknowledged': False,
            'tip': tip_result
        }

        alerts.append(alert)
        self.alerts_generated += 1
        socketio.emit('alert', alert)
        logger.warning(f"ALERT {alert['id']}: TIP Model - {log_line}")
        return alert
    
    def _create_alert(self, rule, log_line, source, tip_result=None):
        """Create an alert object"""
        alert = {
            'id': f"ALERT-{len(alerts)+1:06d}",
            'timestamp': datetime.now().isoformat(),
            'rule_id': rule['id'],
            'rule_name': rule['name'],
            'severity': rule['severity'],
            'description': rule['description'],
            'log_entry': log_line,
            'source': source,
            'acknowledged': False
        }

        if tip_result:
            alert['tip'] = tip_result
        
        alerts.append(alert)
        self.alerts_generated += 1
        
        # Broadcast alert via WebSocket
        socketio.emit('alert', alert)
        
        # Log the alert
        logger.warning(f"ALERT {alert['id']}: {rule['name']} - {log_line}")
        
        return alert
    
    def analyze_log_file(self, file_path, source="file_upload"):
        """Analyze an entire log file"""
        try:
            path = Path(file_path)
            suffix = path.suffix.lower()

            if suffix == '.csv':
                return self._analyze_csv_file(path, source)
            if suffix in {'.json', '.jsonl'}:
                return self._analyze_json_file(path, source)
            return self._analyze_text_file(path, source)
        except Exception as e:
            logger.error(f"Error analyzing file {file_path}: {e}")
            return []

    def _analyze_text_file(self, file_path, source):
        file_alerts = []
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line_alerts = self.analyze_log_line(line, source)
                if line_alerts:
                    file_alerts.extend(line_alerts)
        logger.info(f"Analyzed file {file_path}: {self.logs_processed} logs, {len(file_alerts)} alerts")
        return file_alerts

    def _analyze_csv_file(self, file_path, source):
        file_alerts = []
        with open(file_path, 'r', newline='', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                return self._analyze_text_file(file_path, source)
            for row in reader:
                line_alerts = self.analyze_log_line(json.dumps(row), source)
                if line_alerts:
                    file_alerts.extend(line_alerts)
        logger.info(f"Analyzed CSV file {file_path}: {self.logs_processed} logs, {len(file_alerts)} alerts")
        return file_alerts

    def _analyze_json_file(self, file_path, source):
        file_alerts = []
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            raw = f.read().strip()
        if not raw:
            return file_alerts

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return self._analyze_text_file(file_path, source)

        if isinstance(payload, list):
            for entry in payload:
                line_alerts = self.analyze_log_line(json.dumps(entry), source)
                if line_alerts:
                    file_alerts.extend(line_alerts)
        elif isinstance(payload, dict):
            line_alerts = self.analyze_log_line(json.dumps(payload), source)
            if line_alerts:
                file_alerts.extend(line_alerts)
        else:
            return self._analyze_text_file(file_path, source)

        logger.info(f"Analyzed JSON file {file_path}: {self.logs_processed} logs, {len(file_alerts)} alerts")
        return file_alerts

# Flask Routes
@app.route('/')
def index():
    """Serve the main HTML interface"""
    return render_template_string(HTML_TEMPLATE)

@app.route('/upload', methods=['POST'])
def upload_log_file():
    """Handle log file upload"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file uploaded'})
    
    file = request.files['file']
    source = request.form.get('source', 'uploaded_file')
    
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'})
    
    try:
        # Save uploaded file
        safe_name = Path(file.filename).name
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{safe_name}"
        filepath = UPLOAD_DIR / filename
        file.save(str(filepath))
        
        # Analyze file
        analyzer = SIEMAnalyzer(tip_model=TIP_MODEL)
        alerts_found = analyzer.analyze_log_file(filepath, source)
        run = _register_run('upload', source, analyzer.logs_processed, alerts_found, filename)
        
        # Update WebSocket clients
        socketio.emit('log_update', {
            'logs': log_entries[-50:],  # Last 50 logs
            'stats': _current_stats()
        })
        
        return jsonify({
            'success': True,
            'filename': filename,
            'logs_processed': analyzer.logs_processed,
            'alerts_generated': analyzer.alerts_generated,
            'alerts': alerts_found,
            'report_url': f"/report/{run['report_filename']}",
            'stats': _current_stats()
        })
        
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/analyze', methods=['POST'])
def analyze_log_text():
    """Analyze log text directly"""
    data = request.get_json(silent=True) or {}
    logs = data.get('logs', '')
    source = data.get('source', 'manual')
    
    analyzer = SIEMAnalyzer(tip_model=TIP_MODEL)
    alerts_found = []
    
    for line in logs.split('\n'):
        line_alerts = analyzer.analyze_log_line(line, source)
        if line_alerts:
            alerts_found.extend(line_alerts)

    run = _register_run('manual', source, analyzer.logs_processed, alerts_found)
    
    # Update WebSocket clients
    socketio.emit('log_update', {
        'logs': log_entries[-50:],
        'stats': _current_stats()
    })
    
    return jsonify({
        'success': True,
        'logs_processed': analyzer.logs_processed,
        'alerts_generated': analyzer.alerts_generated,
        'alerts': alerts_found,
        'report_url': f"/report/{run['report_filename']}",
        'stats': _current_stats()
    })

@app.route('/alerts')
def get_alerts():
    """Get all alerts"""
    return jsonify(alerts[-100:])  # Last 100 alerts

@app.route('/logs')
def get_logs():
    """Get recent logs"""
    return jsonify(log_entries[-100:])  # Last 100 logs

@app.route('/rules')
def get_rules():
    """Get detection rules"""
    return jsonify(RULES)

@app.route('/stats')
def get_stats():
    """Get SIEM statistics"""
    return jsonify(_current_stats())


# =============================================================================
# API Endpoints for Laravel Backend Integration
# =============================================================================

@app.route('/api/ingest', methods=['POST'])
def api_ingest_log():
    """
    Ingest a single log entry for real-time analysis.
    
    POST /api/ingest
    Body: { "log": "log entry", "source": "source_name", "metadata": {...} }
    """
    data = request.get_json(silent=True) or {}
    log_entry = data.get('log', '')
    source = data.get('source', 'api')
    metadata = data.get('metadata', {})
    
    if not log_entry:
        return jsonify({'success': False, 'error': 'Log entry is required'}), 400
    
    analyzer = SIEMAnalyzer(tip_model=TIP_MODEL)
    alerts_found = analyzer.analyze_log_line(log_entry, source)
    
    # Update WebSocket clients
    socketio.emit('log_update', {
        'logs': log_entries[-50:],
        'stats': _current_stats()
    })
    
    return jsonify({
        'success': True,
        'processed': True,
        'alerts': alerts_found or [],
        'alerts_generated': len(alerts_found) if alerts_found else 0
    })


@app.route('/api/ingest/batch', methods=['POST'])
def api_ingest_batch():
    """
    Ingest multiple log entries in batch.
    
    POST /api/ingest/batch
    Body: { "logs": ["log1", "log2", ...] or [{"log": "...", "source": "..."}], "default_source": "api_batch" }
    """
    data = request.get_json(silent=True) or {}
    logs = data.get('logs', [])
    default_source = data.get('default_source', 'api_batch')
    
    if not logs:
        return jsonify({'success': False, 'error': 'Logs array is required'}), 400
    
    analyzer = SIEMAnalyzer(tip_model=TIP_MODEL)
    all_alerts = []
    
    for log_item in logs:
        if isinstance(log_item, str):
            log_entry = log_item
            source = default_source
        elif isinstance(log_item, dict):
            log_entry = log_item.get('log', '')
            source = log_item.get('source', default_source)
        else:
            continue
        
        if log_entry:
            line_alerts = analyzer.analyze_log_line(log_entry, source)
            if line_alerts:
                all_alerts.extend(line_alerts)
    
    # Update WebSocket clients
    socketio.emit('log_update', {
        'logs': log_entries[-50:],
        'stats': _current_stats()
    })
    
    return jsonify({
        'success': True,
        'logs_processed': analyzer.logs_processed,
        'alerts_generated': len(all_alerts),
        'alerts': all_alerts
    })


@app.route('/api/alerts/<alert_id>/acknowledge', methods=['POST'])
def api_acknowledge_alert(alert_id):
    """
    Acknowledge an alert by ID.
    
    POST /api/alerts/{alert_id}/acknowledge
    """
    for alert in alerts:
        if alert.get('id') == alert_id:
            alert['acknowledged'] = True
            return jsonify({
                'success': True,
                'message': 'Alert acknowledged',
                'alert': alert
            })
    
    return jsonify({'success': False, 'error': 'Alert not found'}), 404


@app.route('/api/alerts/trends')
def api_alert_trends():
    """
    Get alert trends over time.
    
    GET /api/alerts/trends?period=24h
    """
    period = request.args.get('period', '24h')
    
    # Calculate time boundaries based on period
    now = datetime.now()
    if period == '1h':
        start_time = now - timedelta(hours=1)
        bucket_format = '%Y-%m-%d %H:%M'
    elif period == '6h':
        start_time = now - timedelta(hours=6)
        bucket_format = '%Y-%m-%d %H:00'
    elif period == '24h':
        start_time = now - timedelta(hours=24)
        bucket_format = '%Y-%m-%d %H:00'
    elif period == '7d':
        start_time = now - timedelta(days=7)
        bucket_format = '%Y-%m-%d'
    elif period == '30d':
        start_time = now - timedelta(days=30)
        bucket_format = '%Y-%m-%d'
    else:
        start_time = now - timedelta(hours=24)
        bucket_format = '%Y-%m-%d %H:00'
    
    # Group alerts by time bucket
    trends = defaultdict(lambda: {'total': 0, 'critical': 0, 'high': 0, 'medium': 0, 'low': 0})
    
    for alert in alerts:
        alert_time_str = alert.get('timestamp', '')
        try:
            alert_time = datetime.fromisoformat(alert_time_str.replace('Z', '+00:00'))
            if alert_time.tzinfo:
                alert_time = alert_time.replace(tzinfo=None)
        except (ValueError, AttributeError):
            continue
        
        if alert_time >= start_time:
            bucket = alert_time.strftime(bucket_format)
            severity = alert.get('severity', 'MEDIUM').lower()
            trends[bucket]['total'] += 1
            if severity in trends[bucket]:
                trends[bucket][severity] += 1
    
    # Convert to list format
    trend_data = [
        {'timestamp': bucket, **data}
        for bucket, data in sorted(trends.items())
    ]
    
    return jsonify({
        'period': period,
        'data': trend_data
    })


@app.route('/api/logs/search', methods=['POST'])
def api_search_logs():
    """
    Search logs with filters.
    
    POST /api/logs/search
    Body: { "query": "search term", "source": "source_filter", "from": "timestamp", "to": "timestamp", "limit": 100 }
    """
    data = request.get_json(silent=True) or {}
    query = data.get('query', '').lower()
    source_filter = data.get('source')
    from_time = data.get('from')
    to_time = data.get('to')
    limit = data.get('limit', 100)
    
    results = []
    
    for log in log_entries:
        # Apply query filter
        if query and query not in log.lower():
            continue
        
        # Apply source filter
        if source_filter and source_filter not in log:
            continue
        
        results.append(log)
        
        if len(results) >= limit:
            break
    
    return jsonify({
        'total': len(results),
        'logs': results
    })


@app.route('/api/rules', methods=['POST'])
def api_save_rule():
    """
    Create or update a detection rule.
    
    POST /api/rules
    Body: { "id": "RULE_ID", "name": "Rule Name", "pattern": "regex", "severity": "HIGH", "description": "...", "threshold": 5, "time_window": 300 }
    """
    global RULES
    data = request.get_json(silent=True) or {}
    
    required_fields = ['id', 'name', 'pattern', 'severity', 'description']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'success': False, 'error': f'{field} is required'}), 400
    
    # Validate regex pattern
    try:
        re.compile(data['pattern'])
    except re.error as e:
        return jsonify({'success': False, 'error': f'Invalid regex pattern: {e}'}), 400
    
    # Check if rule exists
    existing_rule = None
    for i, rule in enumerate(RULES):
        if rule['id'] == data['id']:
            existing_rule = i
            break
    
    new_rule = {
        'id': data['id'],
        'name': data['name'],
        'pattern': data['pattern'],
        'severity': data['severity'].upper(),
        'description': data['description']
    }
    
    # Add optional fields
    if data.get('threshold'):
        new_rule['threshold'] = int(data['threshold'])
    if data.get('time_window'):
        new_rule['time_window'] = int(data['time_window'])
    if data.get('alert_on_match'):
        new_rule['alert_on_match'] = bool(data['alert_on_match'])
    
    if existing_rule is not None:
        RULES[existing_rule] = new_rule
        action = 'updated'
    else:
        RULES.append(new_rule)
        action = 'created'
    
    # Save rules to file
    try:
        with open(BASE_DIR / 'rules.json', 'w') as f:
            json.dump({'rules': RULES}, f, indent=4)
    except Exception as e:
        logger.error(f"Failed to save rules: {e}")
    
    return jsonify({
        'success': True,
        'message': f'Rule {action} successfully',
        'rule': new_rule
    })


@app.route('/api/rules/<rule_id>', methods=['DELETE'])
def api_delete_rule(rule_id):
    """
    Delete a detection rule.
    
    DELETE /api/rules/{rule_id}
    """
    global RULES
    
    for i, rule in enumerate(RULES):
        if rule['id'] == rule_id:
            deleted_rule = RULES.pop(i)
            
            # Save rules to file
            try:
                with open(BASE_DIR / 'rules.json', 'w') as f:
                    json.dump({'rules': RULES}, f, indent=4)
            except Exception as e:
                logger.error(f"Failed to save rules: {e}")
            
            return jsonify({
                'success': True,
                'message': 'Rule deleted successfully',
                'rule': deleted_rule
            })
    
    return jsonify({'success': False, 'error': 'Rule not found'}), 404


@app.route('/api/health')
def api_health():
    """
    Health check endpoint for the SIEM service.
    
    GET /api/health
    """
    return jsonify({
        'status': 'healthy',
        'service': 'siem',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat(),
        'stats': _current_stats()
    })


@app.route('/report/latest')
def get_latest_report():
    """Get the most recent HTML report"""
    if not analysis_runs:
        return jsonify({'success': False, 'error': 'No reports available'}), 404
    report_name = analysis_runs[-1].get('report_filename', '')
    return send_from_directory(REPORT_DIR, report_name)

@app.route('/report/<report_name>')
def get_report(report_name):
    """Serve a report file by name"""
    safe_name = Path(report_name).name
    if not safe_name.endswith('.html'):
        return jsonify({'success': False, 'error': 'Invalid report name'}), 400
    report_path = REPORT_DIR / safe_name
    if not report_path.exists():
        return jsonify({'success': False, 'error': 'Report not found'}), 404
    return send_from_directory(REPORT_DIR, safe_name)

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to SIEM server'})

@socketio.on('start_realtime')
def handle_start_realtime(data):
    """Start real-time log monitoring"""
    data = data or {}
    source = data.get('source', 'realtime')
    file_path = data.get('file_path') or data.get('path')
    from_start = str(data.get('from_start', '')).lower() in {'1', 'true', 'yes'}
    logger.info(f"Starting real-time monitoring for client {request.sid}")

    resolved_path, error = _resolve_realtime_path(file_path)
    if error:
        emit('realtime_status', {'success': False, 'error': error})
        return

    _start_realtime_monitor(request.sid, resolved_path, source, from_start)
    emit('realtime_status', {
        'success': True,
        'file_path': str(resolved_path),
        'source': source,
        'from_start': from_start
    })

@socketio.on('stop_realtime')
def handle_stop_realtime():
    """Stop real-time log monitoring"""
    logger.info(f"Stopping real-time monitoring for client {request.sid}")
    _stop_realtime_monitor(request.sid)
    emit('realtime_status', {'success': True, 'stopped': True})

@socketio.on('disconnect')
def handle_disconnect():
    """Cleanup on client disconnect"""
    _stop_realtime_monitor(request.sid)

def generate_sample_logs():
    """Generate sample logs for testing"""
    sample_logs = [
        "Failed login attempt for user 'admin' from IP 192.168.1.100",
        "User 'john' logged in successfully",
        "Firewall blocked SQL injection attempt: ' OR '1'='1",
        "Multiple failed logins detected from IP 10.0.0.5",
        "File upload attempted: malicious.php",
        "Port scan detected from 203.0.113.10",
        "Authentication failure for user 'root'",
        "XSS attempt detected: <script>alert('xss')</script>",
        "Admin accessed sensitive configuration file",
        "Brute force attack detected from 198.51.100.23"
    ]
    
    analyzer = SIEMAnalyzer(tip_model=TIP_MODEL)
    for log in sample_logs:
        analyzer.analyze_log_line(log, "sample")

if __name__ == '__main__':
    logger.info("Starting Simple SIEM Tool...")
    logger.info(f"Loaded {len(RULES)} detection rules")
    
    # Generate some sample logs for demo
    generate_sample_logs()
    
    logger.info(f"Generated {len(alerts)} sample alerts")
    logger.info("Server running on http://localhost:5000")
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
