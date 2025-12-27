import customtkinter as ctk
import json
import os

# =========================
# Threat Intelligence (static blocklist used for demo)
# =========================
malicious_ips = [
    "185.220.101.45",
    "185.220.101.46",  # sample alert IP
    "91.214.124.143"
]

BLOCKLIST_PATH = os.path.join(os.path.dirname(__file__), "blocked_ips.log")
ALERT_FILE = os.path.join(os.path.dirname(__file__), "alert.json")


def check_ip(ip):
    return ip in malicious_ips


# =========================
# Actions
# =========================
def block_ip(ip):
    # Simulate a firewall block by persisting the IP for audit/testing
    with open(BLOCKLIST_PATH, "a") as f:
        f.write(f"{ip}\n")
    return f"Firewall Action: IP {ip} BLOCKED (added to blocklist)"


def create_ticket(alert_id, ip, severity):
    return f"Ticket Created | Alert={alert_id} | IP={ip} | Severity={severity}"


# =========================
# SOAR Engine
# =========================
def run_soar():
    logs = []

    if not os.path.exists(ALERT_FILE):
        logs.append("ERROR: alert.json not found")
        return None, "ERROR", logs

    with open(ALERT_FILE) as f:
        alert = json.load(f)

    ip = alert.get("source_ip")
    if not ip:
        logs.append("ERROR: alert.json missing source_ip")
        return alert, "ERROR", logs

    logs.append("SIEM alert received from file input")
    logs.append(f"Source IP: {ip}")
    logs.append(f"Attack Type: {alert.get('type', '-')}")
    logs.append(f"Severity: {alert.get('severity', '-')}")

    if check_ip(ip):
        decision = "MALICIOUS"
        logs.append("Decision: Malicious IP detected")
        logs.append(block_ip(ip))
        logs.append(create_ticket(alert.get("alert_id", "N/A"), ip, alert.get("severity", "-")))
    else:
        decision = "CLEAN"
        logs.append("Decision: IP is clean - no action required")

    return alert, decision, logs


# =========================
# GUI
# =========================
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("green")

app = ctk.CTk()
app.geometry("1000x650")
app.title("SOAR Automation Platform")

# ---------- Title ----------
title = ctk.CTkLabel(
    app,
    text="SOAR Automation Dashboard",
    font=("Arial", 26, "bold")
)
title.pack(pady=15)

# ---------- Main Frame ----------
main_frame = ctk.CTkFrame(app)
main_frame.pack(fill="both", expand=True, padx=20, pady=10)

# ---------- Left Panel ----------
left_frame = ctk.CTkFrame(main_frame, width=300)
left_frame.pack(side="left", fill="y", padx=10)

ctk.CTkLabel(left_frame, text="Alert Details", font=("Arial", 18)).pack(pady=10)

alert_id_lbl = ctk.CTkLabel(left_frame, text="Alert ID: -")
alert_id_lbl.pack(anchor="w", padx=15, pady=5)

attack_lbl = ctk.CTkLabel(left_frame, text="Attack Type: -")
attack_lbl.pack(anchor="w", padx=15, pady=5)

ip_lbl = ctk.CTkLabel(left_frame, text="Source IP: -")
ip_lbl.pack(anchor="w", padx=15, pady=5)

severity_lbl = ctk.CTkLabel(left_frame, text="Severity: -")
severity_lbl.pack(anchor="w", padx=15, pady=5)

status_lbl = ctk.CTkLabel(
    left_frame,
    text="Status: -",
    font=("Arial", 16, "bold")
)
status_lbl.pack(pady=20)

# ---------- Right Panel ----------
right_frame = ctk.CTkFrame(main_frame)
right_frame.pack(side="right", fill="both", expand=True, padx=10)

ctk.CTkLabel(right_frame, text="SOAR Execution Logs", font=("Arial", 18)).pack(pady=10)

log_box = ctk.CTkTextbox(right_frame, height=350)
log_box.pack(fill="both", expand=True, padx=15, pady=10)


# ---------- Button ----------
def start_soar():
    log_box.delete("1.0", "end")

    alert, decision, logs = run_soar()

    if decision == "ERROR":
        status_lbl.configure(text="Status: ERROR", text_color="orange")
        for log in logs:
            log_box.insert("end", log + "\n")
        return

    alert_id_lbl.configure(text=f"Alert ID: {alert.get('alert_id', '-')}")
    attack_lbl.configure(text=f"Attack Type: {alert.get('type', '-')}")
    ip_lbl.configure(text=f"Source IP: {alert.get('source_ip', '-')}")
    severity_lbl.configure(text=f"Severity: {alert.get('severity', '-')}")

    if decision == "MALICIOUS":
        status_lbl.configure(text="Status: MALICIOUS", text_color="red")
    else:
        status_lbl.configure(text="Status: CLEAN", text_color="green")

    for log in logs:
        log_box.insert("end", log + "\n")


run_btn = ctk.CTkButton(
    app,
    text="Run SOAR Playbook",
    height=45,
    font=("Arial", 16),
    command=start_soar
)
run_btn.pack(pady=15)

app.mainloop()
