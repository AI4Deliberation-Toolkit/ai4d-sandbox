import json
import requests
from pyexpat.errors import messages


def result_explanation(comment, result,client):
    messages = [
        {
            'role': 'user',
            'content': f"""
You are an expert moderator analyzing public discussion comments.
Your task is to explain why a moderation decision was made.
Important rules:
- ALWAYS assume the moderation result is correct.
- Do NOT question or overturn the result.
- Provide a concise explanation that justifies the result based on the content of the comment.

Result (the correct moderation outcome):
{result}
Comment:
{comment}
Explain why this comment would lead to the given moderation result.
## IMPORTANT
False: means its Unflagged
True: means its flagged
            """
        }
    ]

    data = client.chat("gpt-oss:120b", messages, stream=False)
    return data['message']['content']
