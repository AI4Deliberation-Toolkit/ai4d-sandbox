import requests
import json
import re
import requests
import os

LIBRETRANSLATE_URL = os.getenv("LIBRETRANSLATE_URL", "http://localhost:5000")

def libreTranslate(comment):
    try:
        api_endpoint = f"{LIBRETRANSLATE_URL}/translate"

        res = requests.post(
            api_endpoint,
            json={
                "q": comment,
                "source": "auto",
                "target": 'en',
                "format": "text",
                "api_key": ""
            },
            headers={"Content-Type": "application/json"}
        )
        res.raise_for_status()

        response_json = res.json()
        print("LibreTranslate Response:", response_json)
        return response_json.get("translatedText", "Error: Translation key not found in response.")

    except requests.exceptions.RequestException as e:
        print(f"ERROR connecting to LibreTranslate: {e}")
        return "Translation service is unavailable."
    except Exception as e:
        print(f"An unexpected error occurred in libreTranslate: {e}")
        return "An unexpected error occurred during translation."

def ollama_translation(comment, from_language, to_language, modelId, client):
    print(modelId)

    messages = [
        {
            'role': 'user',
            'content': f"""You are a professional terminologist with fluent knowledge of {from_language} and {to_language}. You have been assigned a task to prepare translations from the following text. 
            You have extensive knowledge in eGovernance and are able to supplement the terms with correct translations into {to_language}.
            Prepare a translation of {comment}. Give me directly the translation text without any comments.
            """
        }
    ]

    data = client.chat(modelId, messages, stream=False)
    print(data)
    print(data['message']['content'])
    return data['message']['content']
