import base64
import customtkinter as ctk
import hashlib
import hmac
import json
import os
import time
from tkinter import messagebox

# ================= Auth Settings ==================
STATIC_OTP = "5555"
JWT_SECRET = "dev-secret-change-me"
JWT_TTL_SECONDS = 3600
# ==================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
USER_FILE = os.path.join(SCRIPT_DIR, "users.txt")

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

app = ctk.CTk()
app.geometry("400x520")
app.title("Authentication Tool")

# Global variable to store current user
current_user = ""


# -------- Helper Functions --------
def save_user(username, password):
    """Save user to text file"""
    with open(USER_FILE, "a") as f:
        f.write(f"{username},{password}\n")


def user_exists(username):
    """Check if user exists"""
    if not os.path.exists(USER_FILE):
        return False
    with open(USER_FILE, "r") as f:
        for line in f:
            if "," not in line:
                continue
            u, _ = line.strip().split(",", 1)
            if u == username:
                return True
    return False


def verify_user(username, password):
    """Verify username and password"""
    if not os.path.exists(USER_FILE):
        return False
    with open(USER_FILE, "r") as f:
        for line in f:
            if "," not in line:
                continue
            u, p = line.strip().split(",", 1)
            if u == username and p == password:
                return True
    return False


def _base64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_jwt(username):
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": username, "iat": now, "exp": now + JWT_TTL_SECONDS}
    header_b64 = _base64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _base64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_b64 = _base64url(signature)
    return f"{header_b64}.{payload_b64}.{signature_b64}"


# -------- GUI Logic --------
def signup():
    username = entry_username.get().strip()
    password = entry_password.get().strip()

    if not username or not password:
        messagebox.showwarning("Input Error", "Please enter username and password")
        return

    if user_exists(username):
        messagebox.showerror("Error", "User already exists")
        return

    save_user(username, password)
    messagebox.showinfo("Success", "Account created successfully!")


def signin():
    global current_user
    username = entry_username.get().strip()
    password = entry_password.get().strip()

    if not username or not password:
        messagebox.showwarning("Input Error", "Please enter username and password")
        return

    if verify_user(username, password):
        current_user = username
        show_verification_frame()
    else:
        messagebox.showerror("Error", "Failed Authentication (اترفض)")


def verify_code():
    entered = entry_code.get().strip()
    if entered == STATIC_OTP:
        token = generate_jwt(current_user)
        messagebox.showinfo("Verified", f"Successful Authentication (دخل السيستم)\n\nToken:\n{token}")
        app.destroy()
    else:
        messagebox.showerror("Failed", "Failed Authentication (اترفض)")


# -------- GUI Layout --------
frame_main = ctk.CTkFrame(app)
frame_main.pack(pady=50, padx=20, fill="both", expand=True)

label_title = ctk.CTkLabel(frame_main, text="Sign In / Sign Up", font=("Arial", 22, "bold"))
label_title.pack(pady=20)

entry_username = ctk.CTkEntry(frame_main, placeholder_text="Username")
entry_username.pack(pady=10)

entry_password = ctk.CTkEntry(frame_main, placeholder_text="Password", show="*")
entry_password.pack(pady=10)

btn_signup = ctk.CTkButton(frame_main, text="Sign Up", command=signup)
btn_signup.pack(pady=10)

btn_signin = ctk.CTkButton(frame_main, text="Sign In", command=signin)
btn_signin.pack(pady=10)


# -------- Verification Frame --------
frame_verify = ctk.CTkFrame(app)
label_v = ctk.CTkLabel(frame_verify, text="Enter OTP Code", font=("Arial", 18, "bold"))
label_v.pack(pady=20)

entry_code = ctk.CTkEntry(frame_verify, placeholder_text="OTP code")
entry_code.pack(pady=10)

btn_verify = ctk.CTkButton(frame_verify, text="Verify", command=verify_code)
btn_verify.pack(pady=20)


def show_verification_frame():
    frame_main.pack_forget()
    frame_verify.pack(pady=50, padx=20, fill="both", expand=True)


app.mainloop()
