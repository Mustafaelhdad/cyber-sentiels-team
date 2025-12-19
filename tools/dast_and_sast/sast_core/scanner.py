import ast
import os

class SastScanner:
    """
    محرك فحص SAST احترافي يعتمد على تحليل شجرة بناء الجملة (AST).
    يدعم تحليل مجلد كامل أو ملف واحد.
    """

    def __init__(self, target_path, rules):
        self.target_path = target_path
        self.rules = rules

    def analyze_file(self, file_path):
        """يقرأ ملف بايثون، يحوله إلى شجرة AST، ثم يطبق القواعد عليه."""
        vulnerabilities = []
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                tree = ast.parse(f.read(), filename=file_path)
            except SyntaxError:
                return [] 

        python_rules = [rule for rule in self.rules if rule.get('language') == 'python']

        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'execute':
                if any(isinstance(arg, ast.JoinedStr) for arg in node.args):
                    rule = next((r for r in python_rules if r['id'] == 'SAST002'), None)
                    if rule:
                        vulnerabilities.append(
                            f"{rule['name']} found in {file_path} at line {node.lineno}"
                        )

        return vulnerabilities

    def run_scan(self, logger=None):
        if logger:
            logger.log(f"Starting SAST Scan on: {self.target_path}")

        all_vulnerabilities = []

       
        if os.path.isfile(self.target_path) and self.target_path.endswith('.py'):
            all_vulnerabilities.extend(self.analyze_file(self.target_path))

        
        elif os.path.isdir(self.target_path):
            for root, _, files in os.walk(self.target_path):
                for file in files:
                    if file.endswith('.py'):
                        file_path = os.path.join(root, file)
                        all_vulnerabilities.extend(self.analyze_file(file_path))

        if logger:
            logger.log(f"SAST Scan Finished. Found {len(all_vulnerabilities)} vulnerabilities.")

        return all_vulnerabilities
