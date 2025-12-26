================================================================================
        CYBER SENTINELS - ACCOUNT PROVISIONING TOOL (IAM Demo)
================================================================================

A practical demonstration of Identity & Access Management (IAM) operations:
- Create user accounts
- Modify user details and roles  
- Disable/Enable accounts
- Delete accounts
- Full audit logging for security and compliance

================================================================================
                            QUICK START
================================================================================

OPTION 1: Docker Compose (Recommended)
--------------------------------------
1. Make sure Docker is installed and running
2. Run: docker-compose up --build
3. Access the frontend at: http://localhost:3000
4. API available at: http://localhost:5002

OPTION 2: Development Mode
--------------------------
Backend:
  1. cd tools/account_provisioning_tool
  2. pip install -r requirements.txt
  3. python api.py

Frontend:
  1. cd tools/account_provisioning_tool/frontend
  2. npm install
  3. npm run dev
  4. Access at: http://localhost:3000

================================================================================
                            DATABASE SCHEMA
================================================================================

SQLite database: users.db

Table: users
  - id (INTEGER PRIMARY KEY)
  - username (TEXT UNIQUE NOT NULL)
  - email (TEXT NOT NULL)
  - role (TEXT NOT NULL)
  - status (TEXT DEFAULT 'active')
  - created_at (TEXT)
  - updated_at (TEXT)

Table: audit_log
  - id (INTEGER PRIMARY KEY)
  - action (TEXT NOT NULL)
  - username (TEXT NOT NULL)
  - details (TEXT)
  - performed_by (TEXT DEFAULT 'system')
  - created_at (TEXT)

================================================================================
                            API ENDPOINTS
================================================================================

Health Check:
  GET /health

Users:
  GET    /api/provision/users          - List all users
  GET    /api/provision/users/<name>   - Get user by username
  POST   /api/provision/users          - Create new user
  PUT    /api/provision/users/<name>   - Update user
  DELETE /api/provision/users/<name>   - Delete user
  POST   /api/provision/users/<name>/disable - Disable user
  POST   /api/provision/users/<name>/enable  - Enable user

Bulk Operations:
  POST   /api/provision/bulk           - Bulk create users

Audit & Reports:
  GET    /api/provision/audit          - Get audit log
  GET    /api/provision/report         - Generate security report
  GET    /api/provision/stats          - Get service statistics

Demo:
  POST   /api/provision/demo           - Run demo workflow

================================================================================
                            FRONTEND FEATURES
================================================================================

Dashboard:
  - Overview statistics (total users, active users, disabled users)
  - Activity summary (accounts created, modified, disabled, enabled)
  - Roles distribution chart
  - Status overview
  - System info
  - Run Demo button to populate sample data

User Management:
  - List all users with search and filters
  - Create new users with role and status
  - Edit existing users
  - Enable/Disable user accounts
  - Delete users with confirmation
  - Real-time status updates

Audit Log:
  - Timeline view of all actions
  - Filter by action type
  - Search by username
  - Expandable details for each entry
  - Timestamps for compliance

================================================================================
                            ENVIRONMENT VARIABLES
================================================================================

Backend (api.py):
  PROVISION_HOST        - API host (default: 0.0.0.0)
  PROVISION_PORT        - API port (default: 5002)
  PROVISION_DB_PATH     - Database path (default: /data/users.db)
  PROVISION_REPORTS_DIR - Reports directory (default: /data/reports)
  PROVISION_DEBUG       - Debug mode (default: false)

Frontend:
  VITE_API_URL          - Backend API URL (default: http://localhost:5002)

================================================================================
                            PORTS
================================================================================

  Frontend: 3000 (Nginx in Docker, Vite in dev)
  Backend:  5002

================================================================================
