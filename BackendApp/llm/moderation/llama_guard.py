# import os

# os.environ['OLLAMA_HOST'] = "http://ollama:11434"

import requests

def llama_guard(comment,client):
    messages = [
        {
            'role': 'user',
            'content': comment
        }
    ]
    test = client.chat('llama-guard3:latest', messages, stream=False)
    return test['message']['content']
