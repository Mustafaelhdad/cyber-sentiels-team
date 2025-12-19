# gui_app.py

import customtkinter as ctk
import threading
import os
from tkinter import filedialog, ttk


from sast_core.scanner import SastScanner
from dast_core.scanner import DastScanner
from report_generator.generator import generate_report

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("green")

class SecurityScannerApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("CyberGuard Pro Scanner")
        self.geometry("1200x700")

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # Header
        self.header_frame = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        self.header_frame.grid(row=0, column=0, columnspan=2, sticky="ew", padx=10, pady=10)
        self.header_label = ctk.CTkLabel(self.header_frame, text="", font=ctk.CTkFont(size=24, weight="bold"))
        self.header_label.pack(pady=5)

        # Tab view
        self.tab_view = ctk.CTkTabview(self, width=250)
        self.tab_view.grid(row=1, column=0, padx=20, pady=10, sticky="nsew")
        self.tab_view.add("SAST (Static Analysis)")
        self.tab_view.add("DAST (Dynamic Analysis)")
        
        ## Log Console
        self.log_console = ctk.CTkTextbox(self, height=150)
        self.log_console.grid(row=2, column=0, padx=20, pady=10, sticky="ew")
        self.log("Welcome to Integrated Security Tools in Cyber Security . Ready to scan.")

        ## Control Panel
        self.control_panel = ctk.CTkFrame(self)
        self.control_panel.grid(row=3, column=0, padx=20, pady=10, sticky="ew")
        self.theme_label = ctk.CTkLabel(self.control_panel, text="Appearance:")
        self.theme_label.pack(side="left", padx=(10, 5))
        self.theme_switch = ctk.CTkOptionMenu(self.control_panel, values=["Dark", "Light", "System"], command=ctk.set_appearance_mode)
        self.theme_switch.pack(side="left", padx=5)
        
        # Initialize tabs
        self.setup_sast_tab()
        self.setup_dast_tab()
        
    def log(self, message):
        """Helper function to add messages to the log console."""
        try:
            self.log_console.insert("end", f"[{threading.current_thread().name}] {message}\n")
            self.log_console.see("end") # Auto-scroll
            self.update_idletasks() # Force GUI update
        except Exception:
            # If logging to GUI fails, fallback to print (avoids crash)
            print(f"[LOG ERROR] {message}")

    # ================= SAST Tab =================
    def setup_sast_tab(self):
        sast_tab = self.tab_view.tab("SAST (Static Analysis)")
        sast_input_frame = ctk.CTkFrame(sast_tab)
        sast_input_frame.grid(row=0, column=0, padx=10, pady=10, sticky="ew")
        self.sast_dir_entry = ctk.CTkEntry(sast_input_frame, placeholder_text="Select a directory to scan...")
        self.sast_dir_entry.pack(side="left", fill="x", expand=True, padx=(10, 5), pady=10)
        self.sast_browse_button = ctk.CTkButton(sast_input_frame, text="Browse...", width=100, command=self.browse_sast_directory)
        self.sast_browse_button.pack(side="left", padx=(0, 10), pady=10)
        
        # Results Frame and Treeview setup
        sast_results_frame = ctk.CTkFrame(sast_tab)
        sast_results_frame.grid(row=1, column=0, padx=10, pady=10, sticky="nsew")
        sast_tab.grid_rowconfigure(1, weight=1)
        sast_tab.grid_columnconfigure(0, weight=1)

        columns = ("severity", "rule_id", "file_path", "line_number", "description")
        self.sast_tree = ttk.Treeview(sast_results_frame, columns=columns, show="headings")
        style = ttk.Style()
        try:
            style.theme_use("default")
            style.configure("Treeview", background="#2b2b2b", foreground="white", fieldbackground="#2b2b2b", borderwidth=0)
            style.map('Treeview', background=[('selected', '#2a2d2e')])
            style.configure("Treeview.Heading", background="#565b5e", foreground="white", relief="flat")
            style.map("Treeview.Heading", background=[('active', '#3484F0')])
        except Exception:
            pass

        self.sast_tree.tag_configure('Critical', background='#8B0000', foreground='white')
        self.sast_tree.tag_configure('High', background='#FF4500', foreground='white')
        self.sast_tree.tag_configure('Medium', background='#FFD700', foreground='black')

        for col in columns: self.sast_tree.heading(col, text=col.replace('_', ' ').title())
        self.sast_tree.pack(side="left", fill="both", expand=True)

        # Button Frame
        sast_button_frame = ctk.CTkFrame(sast_tab)
        sast_button_frame.grid(row=2, column=0, padx=10, pady=10, sticky="ew")
        self.sast_scan_button = ctk.CTkButton(sast_button_frame, text="Start SAST Scan", command=self.start_sast_scan_thread)
        self.sast_scan_button.pack(side="left", expand=True, fill="x", padx=5)
        self.sast_export_button = ctk.CTkButton(sast_button_frame, text="Export Report", command=self.export_sast_report, state="disabled")
        self.sast_export_button.pack(side="left", expand=True, fill="x", padx=5)

    def browse_sast_directory(self):
        dir_path = filedialog.askdirectory()
        if dir_path:
            self.sast_dir_entry.delete(0, "end")
            self.sast_dir_entry.insert(0, dir_path)
            self.log(f"Selected directory for SAST scan: {dir_path}")

    def run_sast_scan(self):
        directory = self.sast_dir_entry.get()
        if not directory:
            self.log("SAST Error: Please select a directory first.")
            return

        self.sast_scan_button.configure(state="disabled", text="Scanning...")
        self.sast_export_button.configure(state="disabled")
        self.sast_tree.delete(*self.sast_tree.get_children())
        self.log("Starting SAST scan...")

        try:
            scanner = SastScanner(rules_file="config/sast_rules.yaml")
            self.sast_findings = scanner.scan_directory(directory) # Save findings
        except Exception as e:
            self.log(f"SAST Error: {e}")
            self.sast_findings = []
        self.after(0, self.populate_sast_results)

    def populate_sast_results(self):
        for finding in getattr(self, "sast_findings", []):
            tag = finding.severity if finding.severity in ['Critical', 'High', 'Medium'] else ''
            try:
                self.sast_tree.insert("", "end", values=(finding.severity, finding.rule_id, finding.file_path, finding.line_number, finding.description), tags=(tag,))
            except Exception:
                # fallback if object fields differ
                vals = (
                    getattr(finding, "severity", ""),
                    getattr(finding, "rule_id", ""),
                    getattr(finding, "file_path", ""),
                    getattr(finding, "line_number", ""),
                    getattr(finding, "description", str(finding))
                )
                self.sast_tree.insert("", "end", values=vals, tags=(tag,))
        
        self.log(f"SAST Scan Complete. Found {len(getattr(self, 'sast_findings', []))} potential issues.")
        self.sast_scan_button.configure(state="normal", text="Start SAST Scan")
        if getattr(self, "sast_findings", []):
            self.sast_export_button.configure(state="normal")
            
    def export_sast_report(self):
        output_file = filedialog.asksaveasfilename(defaultextension=".html", filetypes=[("HTML files", "*.html"), ("JSON files", "*.json")])
        if output_file:
            file_format = "json" if output_file.endswith(".json") else "html"
            try:
                generate_report(self.sast_findings, output_file, file_format)
                self.log(f"SAST report exported to {output_file}")
            except Exception as e:
                self.log(f"Failed to export SAST report: {e}")
    
    def start_sast_scan_thread(self):
        threading.Thread(target=self.run_sast_scan, name="SAST-Scanner", daemon=True).start()

    # ================= DAST Tab =================
    def setup_dast_tab(self):
        dast_tab = self.tab_view.tab("DAST (Dynamic Analysis)")
        dast_input_frame = ctk.CTkFrame(dast_tab)
        dast_input_frame.grid(row=0, column=0, padx=10, pady=10, sticky="ew")
        self.dast_url_entry = ctk.CTkEntry(dast_input_frame, placeholder_text="Enter target URL (e.g., http://127.0.0.1:5000)")
        self.dast_url_entry.pack(fill="x", expand=True, padx=10, pady=10)

        # Results Frame and Treeview setup
        dast_results_frame = ctk.CTkFrame(dast_tab)
        dast_results_frame.grid(row=1, column=0, padx=10, pady=10, sticky="nsew")
        dast_tab.grid_rowconfigure(1, weight=1)
        dast_tab.grid_columnconfigure(0, weight=1)
        columns = ("severity", "vuln_type", "url", "payload")
        self.dast_tree = ttk.Treeview(dast_results_frame, columns=columns, show="headings")
        self.dast_tree.tag_configure('High', background='#FF4500', foreground='white')
        self.dast_tree.tag_configure('Medium', background='#FFD700', foreground='black')

        for col in columns:
            self.dast_tree.heading(col, text=col.replace('_', ' ').title())
        self.dast_tree.pack(side="left", fill="both", expand=True)

        # Button Frame
        dast_button_frame = ctk.CTkFrame(dast_tab)
        dast_button_frame.grid(row=2, column=0, padx=10, pady=10, sticky="ew")
        self.dast_scan_button = ctk.CTkButton(dast_button_frame, text="Start DAST Scan", command=self.start_dast_scan_thread)
        self.dast_scan_button.pack(side="left", expand=True, fill="x", padx=5)
        self.dast_export_button = ctk.CTkButton(dast_button_frame, text="Export Report", command=self.export_dast_report, state="disabled")
        self.dast_export_button.pack(side="left", expand=True, fill="x", padx=5)

    def run_dast_scan(self):
        url = self.dast_url_entry.get().strip()
        if not url:
            self.log("DAST Error: Please enter a URL first.")
            return

        self.dast_scan_button.configure(state="disabled", text="Scanning...")
        self.dast_export_button.configure(state="disabled")
        self.dast_tree.delete(*self.dast_tree.get_children())
        self.log(f"Starting DAST scan on {url}...")
        
        # Pass the log function to the scanner so it can send live updates
        try:
            scanner = DastScanner(base_url=url, payloads_file="config/dast_payloads.yaml")
        except Exception as e:
            self.log(f"DAST Initialization Error: {e}")
            self.dast_vulnerabilities = []
            self.after(0, self.populate_dast_results)
            return

        # Run scan in try/except so GUI doesn't crash on scanner exceptions
        try:
            # scanner.run_scan accepts logger which can be a callable (self.log)
            self.dast_vulnerabilities = scanner.run_scan(logger=self.log)
        except Exception as e:
            # Log and continue; show no results instead of crashing
            self.log(f"DAST Error during scan: {e}")
            self.dast_vulnerabilities = []
        self.after(0, self.populate_dast_results)

    def populate_dast_results(self):
        for vuln in getattr(self, "dast_vulnerabilities", []):
            # support both dataclass/object and simple dict/tuple/string
            try:
                severity = getattr(vuln, "severity", "") or (vuln.get("severity") if isinstance(vuln, dict) else "")
                vuln_type = getattr(vuln, "vuln_type", "") or (vuln.get("vuln_type") if isinstance(vuln, dict) else "")
                url = getattr(vuln, "url", "") or (vuln.get("url") if isinstance(vuln, dict) else str(vuln))
                payload = getattr(vuln, "payload", "") or (vuln.get("payload") if isinstance(vuln, dict) else "")
            except Exception:
                severity = vuln_type = url = payload = str(vuln)

            tag = severity if severity in ['High', 'Medium'] else ''
            try:
                self.dast_tree.insert("", "end", values=(severity, vuln_type, url, payload), tags=(tag,))
            except Exception:
                # fallback simple insert
                self.dast_tree.insert("", "end", values=(str(severity), str(vuln_type), str(url), str(payload)))
            
        self.log(f"DAST Scan Complete. Found {len(getattr(self, 'dast_vulnerabilities', []))} vulnerabilities.")
        self.dast_scan_button.configure(state="normal", text="Start DAST Scan")
        if getattr(self, "dast_vulnerabilities", []):
            self.dast_export_button.configure(state="normal")
            
    def export_dast_report(self):
        output_file = filedialog.asksaveasfilename(defaultextension=".html", filetypes=[("HTML files", "*.html"), ("JSON files", "*.json")])
        if output_file:
            file_format = "json" if output_file.endswith(".json") else "html"
            try:
                generate_report(self.dast_vulnerabilities, output_file, file_format)
                self.log(f"DAST report exported to {output_file}")
            except Exception as e:
                self.log(f"Failed to export DAST report: {e}")

    def start_dast_scan_thread(self):
        threading.Thread(target=self.run_dast_scan, name="DAST-Scanner", daemon=True).start()


if __name__ == "__main__":
    app = SecurityScannerApp()
    app.mainloop()
