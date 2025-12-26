import customtkinter as ctk
import hashlib
import os
import re
import csv
from datetime import datetime
import socket
from tkinter import filedialog

# ---------------------- FILES & CONSTANTS ----------------------
USERS_FILE = "users.txt"
LOG_FILE = "login_activity.log"

STATIC_ADMIN_EMAIL = "admin@example.com"
STATIC_ADMIN_PASSWORD = "Admin12345"
STATIC_ADMIN_HASH = hashlib.sha256(STATIC_ADMIN_PASSWORD.encode()).hexdigest()
ADMIN_PIN = "1234"
DEFAULT_GROUP = "general"
ACCESS_POLICIES = ["RBAC", "ABAC"]
ROLE_PRIVILEGES = {
    "admin": {"read", "write", "delete"},
    "manager": {"read", "write"},
    "user": {"read"},
    "member": {"read"},
}
ABAC_DENY_GROUPS = {"banned", "suspended"}
ABAC_WRITE_BLOCK_GROUPS = {"audit", "viewer"}
ABAC_DELETE_GROUPS = {"security", "ops", "admins"}

# ---------------------- LOAD USERS ----------------------
users = {}
def parse_user_line(line):
    parts = [p.strip() for p in line.strip().split(",")]
    if len(parts) < 3:
        return None
    email, password, role = parts[0], parts[1], parts[2]
    group = parts[3] if len(parts) > 3 and parts[3] else DEFAULT_GROUP
    return email, {"password": password, "role": role, "group": group}

if os.path.exists(USERS_FILE):
    with open(USERS_FILE, "r") as f:
        for line in f:
            parsed = parse_user_line(line)
            if parsed:
                email, info = parsed
                users[email] = info

# Ensure static admin exists
users[STATIC_ADMIN_EMAIL] = {
    "password": STATIC_ADMIN_HASH,
    "role": "admin",
    "group": "admins",
}

# ---------------------- HELPER FUNCTIONS ----------------------
def save_users():
    with open(USERS_FILE, "w") as f:
        for email, info in users.items():
            group = info.get("group", DEFAULT_GROUP)
            f.write(f"{email},{info['password']},{info['role']},{group}\n")

def hash_password(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def check_strength(password):
    if len(password) < 8:
        return "Weak: less than 8 characters", "red"
    if not re.search(r"[A-Z]", password):
        return "Weak: missing uppercase letter", "red"
    if not re.search(r"[0-9]", password):
        return "Weak: missing number", "red"
    if not re.search(r"[!@#$%^&*]", password):
        return "Medium: add special characters", "yellow"
    return "Strong password", "lightgreen"

def log_login(email, success):
    ip = socket.gethostbyname(socket.gethostname())
    time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a") as f:
        f.write(f"{time}, {email}, {ip}, {'SUCCESS' if success else 'FAILURE'}\n")

def normalize_role(role):
    role = role.strip().lower()
    if role == "member":
        return "user"
    return role

def evaluate_rbac(role):
    role = normalize_role(role)
    return set(ROLE_PRIVILEGES.get(role, set()))

def evaluate_abac(role, group):
    role = normalize_role(role)
    group = group.strip().lower()
    if group in ABAC_DENY_GROUPS:
        return set()
    privileges = {"read"}
    if role in {"admin", "manager"} and group not in ABAC_WRITE_BLOCK_GROUPS:
        privileges.add("write")
    if role == "admin" and group in ABAC_DELETE_GROUPS:
        privileges.add("delete")
    return privileges

def authorize(role, group, policy):
    policy = policy.strip().upper()
    if policy == "ABAC":
        return evaluate_abac(role, group)
    return evaluate_rbac(role)

# ---------------------- GUI SETUP ----------------------
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

app = ctk.CTk()
app.title("Secure Auth System")
app.geometry("430x620")

frame = ctk.CTkFrame(app, corner_radius=15)
frame.pack(pady=20, padx=20, fill="both", expand=True)

label_title = ctk.CTkLabel(frame, text="🔐 Secure Authentication", font=("Arial", 22))
label_title.pack(pady=10)

# ---------------------- ENTRIES ----------------------
email_entry = ctk.CTkEntry(frame, width=280, placeholder_text="Email")
email_entry.pack(pady=10)

password_entry = ctk.CTkEntry(frame, width=280, placeholder_text="Password", show="*")
password_entry.pack(pady=10)

# Group is stored on the user record and used for authorization policies.
group_entry = ctk.CTkEntry(frame, width=280, placeholder_text="Group (for sign up)")
group_entry.pack(pady=5)

# Show/Hide password
show_pw = False
def toggle_password():
    global show_pw
    show_pw = not show_pw
    password_entry.configure(show="" if show_pw else "*")
    toggle_btn.configure(text="Hide" if show_pw else "Show")
toggle_btn = ctk.CTkButton(frame, text="Show", width=70, command=toggle_password)
toggle_btn.pack(pady=5)

# Password strength label
strength_label = ctk.CTkLabel(frame, text="", font=("Arial", 14))
strength_label.pack(pady=5)

def update_strength(event=None):
    text = password_entry.get()
    msg, color = check_strength(text)
    strength_label.configure(text=msg, text_color=color)
password_entry.bind("<KeyRelease>", update_strength)

# Access policy selection
policy_label = ctk.CTkLabel(frame, text="Access Policy", font=("Arial", 13))
policy_label.pack(pady=(10, 2))

policy_selector = ctk.CTkComboBox(frame, width=200, values=ACCESS_POLICIES)
policy_selector.set("RBAC")
policy_selector.pack(pady=5)

# Output label
output_label = ctk.CTkLabel(frame, text="", text_color="lightgreen", font=("Arial", 13), wraplength=360)
output_label.pack(pady=5)

# ---------------------- AUTH FUNCTIONS ----------------------
def signup():
    email = email_entry.get()
    pw = password_entry.get()
    group = group_entry.get().strip() or DEFAULT_GROUP

    if email in users:
        output_label.configure(text="Email already exists", text_color="red")
        return

    users[email] = {"password": hash_password(pw), "role": "user", "group": group}
    save_users()
    output_label.configure(text="Signup successful", text_color="lightgreen")

def signin():
    email = email_entry.get()
    pw = password_entry.get()

    if email not in users:
        output_label.configure(text="No account found", text_color="red")
        log_login(email, False)
        return

    if users[email]["password"] != hash_password(pw):
        output_label.configure(text="Wrong password", text_color="red")
        log_login(email, False)
        return

    role = users[email]["role"]
    group = users[email].get("group", DEFAULT_GROUP)
    policy = policy_selector.get().strip().upper()
    privileges = authorize(role, group, policy)
    decision = "Access Granted" if privileges else "Access Denied"
    priv_text = ", ".join(sorted(privileges)) if privileges else "none"
    output_label.configure(
        text=f"{decision}\nRole: {role} | Group: {group}\nPolicy: {policy}\nPrivileges: {priv_text}",
        text_color="lightgreen" if privileges else "red",
    )
    log_login(email, True)

    if normalize_role(role) == "admin":
        ask_admin_pin()

# ---------------------- ADMIN PANEL ----------------------
def ask_admin_pin():
    pin_window = ctk.CTkToplevel(app)
    pin_window.title("Admin PIN Required")
    pin_window.geometry("300x180")

    label = ctk.CTkLabel(pin_window, text="Enter Admin PIN", font=("Arial", 16))
    label.pack(pady=15)

    pin_entry = ctk.CTkEntry(pin_window, width=200, show="*")
    pin_entry.pack(pady=10)

    msg = ctk.CTkLabel(pin_window, text="")
    msg.pack()

    def verify():
        if pin_entry.get() == ADMIN_PIN:
            pin_window.destroy()
            open_admin()
        else:
            msg.configure(text="Wrong PIN", text_color="red")

    submit_btn = ctk.CTkButton(pin_window, text="Submit", command=verify)
    submit_btn.pack(pady=10)

def open_admin():
    admin = ctk.CTkToplevel(app)
    admin.title("Admin Panel")
    admin.geometry("600x600")

    # ---------------------- TITLE ----------------------
    label = ctk.CTkLabel(admin, text="🛠 User Management", font=("Arial", 20))
    label.pack(pady=10)

    # ---------------------- SEARCH ----------------------
    search_entry = ctk.CTkEntry(admin, width=300, placeholder_text="Search users...")
    search_entry.pack(pady=5)

    # ---------------------- USER LIST ----------------------
    user_list = ctk.CTkComboBox(admin, width=300, values=list(users.keys()))
    user_list.pack(pady=10)

    # Editable fields
    email_edit = ctk.CTkEntry(admin, width=300, placeholder_text="New Email")
    email_edit.pack(pady=5)

    password_edit = ctk.CTkEntry(admin, width=300, placeholder_text="New Password", show="*")
    password_edit.pack(pady=5)

    role_edit = ctk.CTkComboBox(admin, width=200, values=["admin", "manager", "user", "member"])
    role_edit.pack(pady=5)

    group_edit = ctk.CTkEntry(admin, width=300, placeholder_text="Group")
    group_edit.pack(pady=5)

    msg = ctk.CTkLabel(admin, text="")
    msg.pack(pady=5)

    def refresh_users():
        user_list.configure(values=list(users.keys()))

    def filter_users(event=None):
        query = search_entry.get().lower()
        filtered = [u for u in users.keys() if query in u.lower()]
        user_list.configure(values=filtered)
    search_entry.bind("<KeyRelease>", filter_users)

    # ---------------------- UPDATE / DELETE ----------------------
    def update_user():
        selected = user_list.get()
        if selected not in users:
            msg.configure(text="Select a user first", text_color="red")
            return

        new_email = email_edit.get().strip()
        new_pw = password_edit.get().strip()
        new_role = role_edit.get().strip()
        new_group = group_edit.get().strip()

        # Update email
        if new_email:
            users[new_email] = users.pop(selected)
            selected = new_email

        # Update password
        if new_pw:
            users[selected]["password"] = hash_password(new_pw)

        # Update role
        if new_role:
            users[selected]["role"] = new_role
        if new_group:
            users[selected]["group"] = new_group

        save_users()
        refresh_users()
        msg.configure(text="User updated successfully", text_color="lightgreen")

    def delete_user():
        selected = user_list.get()
        if selected == STATIC_ADMIN_EMAIL:
            msg.configure(text="Cannot delete static admin", text_color="red")
            return
        if selected in users:
            users.pop(selected)
            save_users()
            refresh_users()
            msg.configure(text="User deleted", text_color="yellow")

    update_btn = ctk.CTkButton(admin, text="Update User", width=200, command=update_user)
    update_btn.pack(pady=5)

    del_btn = ctk.CTkButton(admin, text="Delete User", width=200, command=delete_user)
    del_btn.pack(pady=5)

    # ---------------------- EXPORT / IMPORT ----------------------
    def export_users():
        with open("users_export.csv", "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["Email", "Password Hash", "Role", "Group"])
            for email, info in users.items():
                writer.writerow([email, info["password"], info["role"], info.get("group", DEFAULT_GROUP)])
        msg.configure(text="Users exported to users_export.csv", text_color="lightgreen")

    def import_users():
        file_path = filedialog.askopenfilename(filetypes=[("CSV files", "*.csv")])
        if not file_path:
            return
        with open(file_path, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                users[row["Email"]] = {
                    "password": row["Password Hash"],
                    "role": row["Role"],
                    "group": row.get("Group") or DEFAULT_GROUP,
                }
        save_users()
        refresh_users()
        msg.configure(text="Users imported successfully", text_color="lightgreen")

    export_btn = ctk.CTkButton(admin, text="Export Users", width=200, command=export_users)
    export_btn.pack(pady=5)

    import_btn = ctk.CTkButton(admin, text="Import Users", width=200, command=import_users)
    import_btn.pack(pady=5)

    # ---------------------- VIEW LOG ----------------------
    def view_logs():
        log_window = ctk.CTkToplevel(admin)
        log_window.title("Login Activity Log")
        log_window.geometry("600x400")
        box = ctk.CTkTextbox(log_window, width=580, height=350)
        box.pack(pady=10)
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, "r") as f:
                box.insert("end", f.read())

    log_btn = ctk.CTkButton(admin, text="View Login Logs", width=200, command=view_logs)
    log_btn.pack(pady=5)

    # ---------------------- THEME SWITCHER ----------------------
    def toggle_theme():
        current = ctk.get_appearance_mode()
        ctk.set_appearance_mode("dark" if current == "light" else "light")

    theme_btn = ctk.CTkButton(admin, text="Toggle Theme", width=200, command=toggle_theme)
    theme_btn.pack(pady=5)

# ---------------------- BUTTONS ----------------------
btn_signup = ctk.CTkButton(frame, text="Sign Up", width=200, height=40, command=signup)
btn_signup.pack(pady=10)

btn_signin = ctk.CTkButton(frame, text="Sign In", width=200, height=40, command=signin)
btn_signin.pack(pady=10)

app.mainloop()
