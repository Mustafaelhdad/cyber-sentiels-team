# vulnerable_flask_app.py
from flask import Flask, request, render_template_string
import sqlite3


app = Flask(__name__)


# --- Database Setup (for SQLi demo) ---
def init_db():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute('DROP TABLE IF EXISTS users')
    cursor.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)')
    cursor.execute("INSERT INTO users (username, password) VALUES ('admin', 'password123')")
    cursor.execute("INSERT INTO users (username, password) VALUES ('user', 'qwerty')")
    conn.commit()
    conn.close()

# --- HTML Templates ---
HOME_TEMPLATE = '''
<!DOCTYPE html>
<html><head><title>Vulnerable App</title></head>
<body><h1>Welcome!</h1>
<p>This application is used to test the CyberGuard Pro Scanner.</p>
<ul><li><a href="/search">Test for XSS</a></li><li><a href="/login">Test for SQL Injection</a></li></ul>
</body></html>'''

SEARCH_TEMPLATE = '''
<!DOCTYPE html>
<html><head><title>Search</title></head>
<body><h1>Search Page (Vulnerable to XSS)</h1>
<form action="/search" method="get"><input type="text" name="query" placeholder="Enter search term..."><input type="submit" value="Search"></form>
<hr><h2>Search results for: {{search_term}}</h2></body></html>'''

LOGIN_TEMPLATE = '''
<!DOCTYPE html>
<html><head><title>Login</title></head>
<body><h1>Login Page (Vulnerable to SQL Injection)</h1>
<form action="/login" method="post"><input type="text" name="username" placeholder="Username"><br><input type="password" name="password" placeholder="Password"><br><input type="submit" value="Login"></form>
<hr><h3>{{message}}</h3></body></html>'''

# --- Routes ---
@app.route('/')
def home(): return render_template_string(HOME_TEMPLATE)

@app.route('/search')
def search():
    query = request.args.get('query', '')
    # VULNERABILITY: User input is rendered directly without sanitization
    return render_template_string(SEARCH_TEMPLATE, search_term=query)

@app.route('/login', methods=['GET', 'POST'])
def login():
    message = "Please login"
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        conn = sqlite3.connect('users.db')
        cursor = conn.cursor()
        try:
            # VULNERABILITY: User input is concatenated directly into the SQL query
            query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"
            cursor.execute(query)
            user = cursor.fetchone()
            if user: message = f"Welcome, {user[1]}!"
            else: message = "Invalid credentials."
        except sqlite3.Error as e:
            # This error message will be caught by our DAST/RA SP scanner
            message = f"Database Error: {e}"
        conn.close()
    return render_template_string(LOGIN_TEMPLATE, message=message)

if __name__ == '__main__':
    init_db()
    # شغّل السيرفر على بورت 5000 (كما في التعليمات السابقة)
    app.run(debug=True, port=5000)
