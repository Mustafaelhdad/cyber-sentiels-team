import customtkinter as ctk
import smtplib
import random
import os
from email.message import EmailMessage
from tkinter import messagebox

# ================= Email Settings ==================
SENDER_EMAIL = "jean60@ethereal.email"
SENDER_PASS = "ujj4wHsekPpq5hZqPw"
SMTP_SERVER = "smtp.ethereal.email"
SMTP_PORT = 587
# ===================================================

USER_FILE = "users.txt"

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

app = ctk.CTk()
app.geometry("400x500")
app.title("Email Sign In / Sign Up")

# Global variable to store verification code
verification_code = ""
current_email = ""


# -------- Helper Functions --------
def save_user(email, password):
    """Save user to text file"""
    with open(USER_FILE, "a") as f:
        f.write(f"{email},{password}\n")


def user_exists(email):
    """Check if user exists"""
    if not os.path.exists(USER_FILE):
        return False
    with open(USER_FILE, "r") as f:
        for line in f:
            e, _ = line.strip().split(",", 1)
            if e == email:
                return True
    return False


def verify_user(email, password):
    """Verify email and password"""
    if not os.path.exists(USER_FILE):
        return False
    with open(USER_FILE, "r") as f:
        for line in f:
            e, p = line.strip().split(",", 1)
            if e == email and p == password:
                return True
    return False


def send_verification_code(email):
    """Generate and send 4-digit code"""
    global verification_code
    verification_code = str(random.randint(1000, 9999))

    msg = EmailMessage()
    msg["Subject"] = "Your Verification Code"
    msg["From"] = SENDER_EMAIL
    msg["To"] = email
    msg.set_content(f"Your verification code is: {verification_code}")

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASS)
            server.send_message(msg)
        return True
    except Exception as e:
        messagebox.showerror("Email Error", f"Failed to send email:\n{e}")
        return False


# -------- GUI Logic --------
def signup():
    email = entry_email.get().strip()
    password = entry_password.get().strip()

    if not email or not password:
        messagebox.showwarning("Input Error", "Please enter email and password")
        return

    if user_exists(email):
        messagebox.showerror("Error", "User already exists")
        return

    save_user(email, password)
    messagebox.showinfo("Success", "Account created successfully!")


def signin():
    global current_email
    email = entry_email.get().strip()
    password = entry_password.get().strip()

    if not email or not password:
        messagebox.showwarning("Input Error", "Please enter email and password")
        return

    if verify_user(email, password):
        current_email = email
        if send_verification_code(email):
            show_verification_frame()
    else:
        messagebox.showerror("Error", "Invalid email or password")


def verify_code():
    entered = entry_code.get().strip()
    if entered == verification_code:
        messagebox.showinfo("Verified", "✅ Verification successful!")
        app.destroy()
    else:
        messagebox.showerror("Failed", "❌ Incorrect verification code")


# -------- GUI Layout --------
frame_main = ctk.CTkFrame(app)
frame_main.pack(pady=50, padx=20, fill="both", expand=True)

label_title = ctk.CTkLabel(frame_main, text="Sign In / Sign Up", font=("Arial", 22, "bold"))
label_title.pack(pady=20)

entry_email = ctk.CTkEntry(frame_main, placeholder_text="Email")
entry_email.pack(pady=10)

entry_password = ctk.CTkEntry(frame_main, placeholder_text="Password", show="*")
entry_password.pack(pady=10)

btn_signup = ctk.CTkButton(frame_main, text="Sign Up", command=signup)
btn_signup.pack(pady=10)

btn_signin = ctk.CTkButton(frame_main, text="Sign In", command=signin)
btn_signin.pack(pady=10)


# -------- Verification Frame --------
frame_verify = ctk.CTkFrame(app)
label_v = ctk.CTkLabel(frame_verify, text="Enter 4-Digit Code", font=("Arial", 18, "bold"))
label_v.pack(pady=20)

entry_code = ctk.CTkEntry(frame_verify, placeholder_text="4-digit code")
entry_code.pack(pady=10)

btn_verify = ctk.CTkButton(frame_verify, text="Verify", command=verify_code)
btn_verify.pack(pady=20)

def show_verification_frame():
    frame_main.pack_forget()
    frame_verify.pack(pady=50, padx=20, fill="both", expand=True)


app.mainloop()
