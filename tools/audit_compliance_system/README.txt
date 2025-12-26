Audit & Compliance Monitoring System

Features:
- Audit log monitoring
- Risk scoring for suspicious activities
- Alerts generation
- Compliance reporting

How to Run:
1. python db/audit_db.py
2. python monitoring/audit_tool.py
3. python reports/compliance_report.py

API:
1. python api_server.py
2. GET http://localhost:5060/health
3. POST http://localhost:5060/api/audit/log {"user":"ahmed","action":"Failed login attempt"}
4. GET http://localhost:5060/api/audit/report

Docker:
1. docker build -t audit-compliance .
2. docker run --rm -p 5060:5060 -v audit-data:/data audit-compliance
3. docker run --rm -e AUDIT_MODE=log -e AUDIT_USER=ahmed -e AUDIT_ACTION="Failed login attempt" -v audit-data:/data audit-compliance
4. docker run --rm -e AUDIT_MODE=report -v audit-data:/data audit-compliance
