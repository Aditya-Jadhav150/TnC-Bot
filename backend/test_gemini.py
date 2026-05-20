import requests
import json
from app.config import settings

def test_connection():
    print("Settings GEMINI_API_KEY:", settings.GEMINI_API_KEY)
    print("Settings GEMINI_BASE_URL:", settings.GEMINI_BASE_URL)
    
    # 1. Test direct generateContent REST call to Gemini 1.5 Flash
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}
    body = {
        "contents": [{"parts": [{"text": "Hello, respond in one word."}]}]
    }
    
    try:
        response = requests.post(url, headers=headers, json=body)
        print("\n--- Direct REST Response (v1beta) ---")
        print("Status Code:", response.status_code)
        print("Response:", response.text[:400])
    except Exception as e:
        print("Direct REST call failed:", e)
        
    # 2. Test ListModels REST call
    list_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={settings.GEMINI_API_KEY}"
    try:
        list_resp = requests.get(list_url)
        print("\n--- ListModels Response ---")
        print("Status Code:", list_resp.status_code)
        if list_resp.status_code == 200:
            models_data = list_resp.json()
            models = [m["name"] for m in models_data.get("models", [])]
            print("Supported models:", models[:15])
        else:
            print("Response:", list_resp.text[:400])
    except Exception as e:
        print("ListModels call failed:", e)

if __name__ == "__main__":
    test_connection()
