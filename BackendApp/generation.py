import secrets

def generate_api_key():
    return secrets.token_urlsafe(43)  # ~43 characters, very secure

key = generate_api_key()
print(key)