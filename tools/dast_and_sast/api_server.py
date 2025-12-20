#!/usr/bin/env python3
"""
SAST Scanner API Server

Provides an HTTP API for the SAST scanner to be used by the web application.
Similar to the WAF tool integration pattern.

Endpoints:
    GET  /health              - Health check
    POST /scan                - Start a new scan
    GET  /scan/<scan_id>      - Get scan status/results
    GET  /rules               - List available rules

Usage:
    # Development
    python api_server.py
    
    # Production (via gunicorn in Docker)
    gunicorn --bind 0.0.0.0:8080 --workers 2 api_server:app
"""

import json
import os
import shutil
import tempfile
import threading
import time
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from flask import Flask, jsonify, request, send_file

from sast_core.scanner import SastScanner
from sast_core.models import ScanResult
from report_generator.generator import generate_report

app = Flask(__name__)

# Configuration
RULES_FILE = os.environ.get('SAST_RULES_FILE', 'config/sast_rules.yaml')
OUTPUT_DIR = os.environ.get('SAST_OUTPUT_DIR', '/app/output')
SCANS_DIR = os.environ.get('SAST_SCANS_DIR', '/app/scans')
MAX_UPLOAD_SIZE = int(os.environ.get('MAX_UPLOAD_SIZE', 100 * 1024 * 1024))  # 100MB default

# In-memory scan tracking (in production, use Redis or database)
# Note: With gunicorn workers, this is per-process. We also persist to disk.
scans = {}


def load_scan_from_disk(scan_id: str) -> dict:
    """Load scan metadata from disk if not in memory."""
    scan_dir = os.path.join(SCANS_DIR, scan_id)
    metadata_path = os.path.join(scan_dir, 'metadata.json')
    
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    
    # Check if report exists (scan completed but metadata lost)
    report_json = os.path.join(scan_dir, 'report.json')
    report_html = os.path.join(scan_dir, 'report.html')
    
    if os.path.exists(report_json) or os.path.exists(report_html):
        report_path = report_json if os.path.exists(report_json) else report_html
        
        # Try to reconstruct metadata from report
        scan_data = {
            'id': scan_id,
            'status': ScanStatus.COMPLETED,
            'source_path': os.path.join(scan_dir, 'source'),
            'output_format': 'json' if os.path.exists(report_json) else 'html',
            'callback_url': None,
            'created_at': datetime.utcnow().isoformat() + 'Z',
            'started_at': None,
            'completed_at': datetime.utcnow().isoformat() + 'Z',
            'total_findings': 0,
            'severity_counts': {},
            'report_path': report_path,
            'error': None
        }
        
        # Try to extract findings count from JSON report
        if os.path.exists(report_json):
            try:
                with open(report_json, 'r') as f:
                    report_data = json.load(f)
                    findings = report_data.get('findings', [])
                    scan_data['total_findings'] = len(findings)
                    severity_counts = {}
                    for finding in findings:
                        sev = finding.get('severity', 'Unknown')
                        severity_counts[sev] = severity_counts.get(sev, 0) + 1
                    scan_data['severity_counts'] = severity_counts
            except Exception:
                pass
        
        return scan_data
    
    return None


def save_scan_to_disk(scan_id: str, scan_data: dict):
    """Save scan metadata to disk for persistence."""
    scan_dir = os.path.join(SCANS_DIR, scan_id)
    os.makedirs(scan_dir, exist_ok=True)
    metadata_path = os.path.join(scan_dir, 'metadata.json')
    
    try:
        with open(metadata_path, 'w') as f:
            json.dump(scan_data, f, indent=2)
    except Exception as e:
        print(f"[SAST] Failed to save scan metadata: {e}")


def get_scan(scan_id: str) -> dict:
    """Get scan from memory or disk."""
    if scan_id in scans:
        return scans[scan_id]
    
    # Try to load from disk
    scan_data = load_scan_from_disk(scan_id)
    if scan_data:
        scans[scan_id] = scan_data
        return scan_data
    
    return None


class ScanStatus:
    PENDING = 'pending'
    RUNNING = 'running'
    COMPLETED = 'completed'
    FAILED = 'failed'


def ensure_dirs():
    """Ensure required directories exist."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(SCANS_DIR, exist_ok=True)


ensure_dirs()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Docker/Kubernetes."""
    return jsonify({
        'status': 'healthy',
        'service': 'sast-scanner',
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    })


@app.route('/rules', methods=['GET'])
def list_rules():
    """List all available SAST rules."""
    try:
        scanner = SastScanner(rules_file=RULES_FILE)
        rules = []
        for rule in scanner.rules:
            rules.append({
                'id': rule.get('id'),
                'name': rule.get('name'),
                'severity': rule.get('severity'),
                'language': rule.get('language'),
                'cwe': rule.get('cwe'),
                'description': rule.get('description', '')[:200]  # Truncate for list view
            })
        return jsonify({
            'total': len(rules),
            'rules': rules
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/scan', methods=['POST'])
def start_scan():
    """
    Start a new SAST scan.
    
    Accepts either:
    1. JSON body with 'source_path' for scanning a local path (inside container)
    2. Multipart form with 'source' file (zip archive) to be extracted and scanned
    
    Optional parameters:
    - output_format: 'json' or 'html' (default: json)
    - callback_url: URL to POST results when scan completes
    
    Returns:
        scan_id for tracking the scan status
    """
    scan_id = str(uuid.uuid4())
    scan_dir = os.path.join(SCANS_DIR, scan_id)
    os.makedirs(scan_dir, exist_ok=True)
    
    output_format = request.form.get('output_format', 'json')
    if request.is_json:
        output_format = request.json.get('output_format', 'json')
    
    callback_url = request.form.get('callback_url')
    if request.is_json:
        callback_url = request.json.get('callback_url')
    
    source_path = None
    
    # Option 1: Scan a path already in the container
    if request.is_json:
        data = request.json
        source_path = data.get('source_path')
        if source_path and not os.path.exists(source_path):
            return jsonify({'error': f'Source path does not exist: {source_path}'}), 400
    
    # Option 2: Upload a zip file
    elif 'source' in request.files:
        file = request.files['source']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        
        if size > MAX_UPLOAD_SIZE:
            return jsonify({'error': f'File too large. Max size: {MAX_UPLOAD_SIZE // (1024*1024)}MB'}), 400
        
        # Save and extract zip
        zip_path = os.path.join(scan_dir, 'source.zip')
        extract_path = os.path.join(scan_dir, 'source')
        
        try:
            file.save(zip_path)
            
            # Extract zip
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_path)
            
            source_path = extract_path
            
            # Clean up zip file
            os.remove(zip_path)
            
        except zipfile.BadZipFile:
            shutil.rmtree(scan_dir, ignore_errors=True)
            return jsonify({'error': 'Invalid zip file'}), 400
        except Exception as e:
            shutil.rmtree(scan_dir, ignore_errors=True)
            return jsonify({'error': f'Failed to extract source: {str(e)}'}), 500
    
    else:
        return jsonify({'error': 'No source provided. Send JSON with source_path or upload a zip file.'}), 400
    
    # Initialize scan record
    scans[scan_id] = {
        'id': scan_id,
        'status': ScanStatus.PENDING,
        'source_path': source_path,
        'output_format': output_format,
        'callback_url': callback_url,
        'created_at': datetime.utcnow().isoformat() + 'Z',
        'started_at': None,
        'completed_at': None,
        'total_findings': 0,
        'severity_counts': {},
        'report_path': None,
        'error': None
    }
    
    # Start scan in background thread
    thread = threading.Thread(
        target=run_scan_async,
        args=(scan_id, source_path, scan_dir, output_format, callback_url)
    )
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'scan_id': scan_id,
        'status': ScanStatus.PENDING,
        'message': 'Scan started successfully'
    }), 202


def run_scan_async(
    scan_id: str,
    source_path: str,
    scan_dir: str,
    output_format: str,
    callback_url: Optional[str]
):
    """Run the SAST scan asynchronously."""
    try:
        scans[scan_id]['status'] = ScanStatus.RUNNING
        scans[scan_id]['started_at'] = datetime.utcnow().isoformat() + 'Z'
        
        # Create scanner and run
        scanner = SastScanner(rules_file=RULES_FILE)
        scan_result = scanner.scan_to_result(source_path)
        
        # Calculate severity counts
        severity_counts = {}
        for finding in scan_result.findings:
            sev = finding.severity
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
        
        # Generate report
        report_filename = f'report.{output_format}'
        report_path = os.path.join(scan_dir, report_filename)
        
        scan_metadata = {
            'target_path': source_path,
            'scan_duration_seconds': scan_result.scan_duration_seconds
        }
        
        generate_report(
            findings=scan_result.findings,
            output_file=report_path,
            format=output_format,
            scan_metadata=scan_metadata
        )
        
        # Update scan record
        scans[scan_id]['status'] = ScanStatus.COMPLETED
        scans[scan_id]['completed_at'] = datetime.utcnow().isoformat() + 'Z'
        scans[scan_id]['total_findings'] = len(scan_result.findings)
        scans[scan_id]['severity_counts'] = severity_counts
        scans[scan_id]['report_path'] = report_path
        scans[scan_id]['scan_duration_seconds'] = scan_result.scan_duration_seconds
        
        # Persist to disk for multi-worker support
        save_scan_to_disk(scan_id, scans[scan_id])
        print(f"[+] Report saved to {report_path}")
        
        # Send callback if configured
        if callback_url:
            try:
                import requests
                requests.post(callback_url, json={
                    'scan_id': scan_id,
                    'status': ScanStatus.COMPLETED,
                    'total_findings': len(scan_result.findings),
                    'severity_counts': severity_counts
                }, timeout=30)
            except Exception as e:
                print(f"[SAST] Failed to send callback: {e}")
        
    except Exception as e:
        scans[scan_id]['status'] = ScanStatus.FAILED
        scans[scan_id]['completed_at'] = datetime.utcnow().isoformat() + 'Z'
        scans[scan_id]['error'] = str(e)
        
        # Send failure callback
        if callback_url:
            try:
                import requests
                requests.post(callback_url, json={
                    'scan_id': scan_id,
                    'status': ScanStatus.FAILED,
                    'error': str(e)
                }, timeout=30)
            except:
                pass


@app.route('/scan/<scan_id>', methods=['GET'])
def get_scan_status(scan_id: str):
    """Get the status and results of a scan."""
    scan = get_scan(scan_id)
    if not scan:
        return jsonify({'error': 'Scan not found'}), 404
    
    response = {
        'id': scan['id'],
        'status': scan['status'],
        'created_at': scan['created_at'],
        'started_at': scan['started_at'],
        'completed_at': scan['completed_at'],
        'total_findings': scan['total_findings'],
        'severity_counts': scan['severity_counts'],
        'error': scan.get('error')
    }
    
    if scan.get('scan_duration_seconds'):
        response['scan_duration_seconds'] = scan['scan_duration_seconds']
    
    return jsonify(response)


@app.route('/scan/<scan_id>/report', methods=['GET'])
def download_report(scan_id: str):
    """Download the scan report."""
    scan = get_scan(scan_id)
    if not scan:
        return jsonify({'error': 'Scan not found'}), 404
    
    if scan['status'] != ScanStatus.COMPLETED:
        return jsonify({'error': f'Scan not completed. Current status: {scan["status"]}'}), 400
    
    report_path = scan.get('report_path')
    if not report_path or not os.path.exists(report_path):
        return jsonify({'error': 'Report file not found'}), 404
    
    # Determine MIME type
    if report_path.endswith('.json'):
        mimetype = 'application/json'
    else:
        mimetype = 'text/html'
    
    return send_file(
        report_path,
        mimetype=mimetype,
        as_attachment=True,
        download_name=os.path.basename(report_path)
    )


@app.route('/scan/<scan_id>/findings', methods=['GET'])
def get_findings(scan_id: str):
    """Get the detailed findings as JSON (regardless of output format chosen)."""
    scan = get_scan(scan_id)
    if not scan:
        return jsonify({'error': 'Scan not found'}), 404
    
    if scan['status'] != ScanStatus.COMPLETED:
        return jsonify({'error': f'Scan not completed. Current status: {scan["status"]}'}), 400
    
    report_path = scan.get('report_path')
    
    # If the report is JSON, return it directly
    if report_path and report_path.endswith('.json') and os.path.exists(report_path):
        with open(report_path, 'r') as f:
            return jsonify(json.load(f))
    
    # Otherwise, re-generate JSON findings
    # (This case handles when HTML was chosen as output)
    return jsonify({
        'error': 'Findings not available in JSON format. Download the HTML report instead.'
    }), 400


@app.route('/scan/<scan_id>', methods=['DELETE'])
def delete_scan(scan_id: str):
    """Delete a scan and its files."""
    scan = get_scan(scan_id)
    if not scan:
        return jsonify({'error': 'Scan not found'}), 404
    
    # Don't delete running scans
    if scan['status'] == ScanStatus.RUNNING:
        return jsonify({'error': 'Cannot delete a running scan'}), 400
    
    # Delete scan directory
    scan_dir = os.path.join(SCANS_DIR, scan_id)
    if os.path.exists(scan_dir):
        shutil.rmtree(scan_dir, ignore_errors=True)
    
    # Remove from memory
    del scans[scan_id]
    
    return jsonify({'message': 'Scan deleted successfully'})


@app.route('/scans', methods=['GET'])
def list_scans():
    """List all scans with pagination."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status_filter = request.args.get('status')
    
    # Filter scans
    filtered_scans = list(scans.values())
    if status_filter:
        filtered_scans = [s for s in filtered_scans if s['status'] == status_filter]
    
    # Sort by created_at descending
    filtered_scans.sort(key=lambda x: x['created_at'], reverse=True)
    
    # Paginate
    total = len(filtered_scans)
    start = (page - 1) * per_page
    end = start + per_page
    paginated = filtered_scans[start:end]
    
    return jsonify({
        'total': total,
        'page': page,
        'per_page': per_page,
        'scans': [{
            'id': s['id'],
            'status': s['status'],
            'created_at': s['created_at'],
            'completed_at': s['completed_at'],
            'total_findings': s['total_findings'],
            'severity_counts': s['severity_counts']
        } for s in paginated]
    })


@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large'}), 413


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Development server
    print("[SAST] Starting development server on port 8080...")
    app.run(host='0.0.0.0', port=8080, debug=True)

