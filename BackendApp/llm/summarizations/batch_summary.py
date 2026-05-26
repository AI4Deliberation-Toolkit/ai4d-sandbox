import json
import re
import requests
from pyexpat.errors import messages


def batch_summary(clusters ,modelId, summary_type, client):
    summaries = []
    for cluster_id, items in clusters.items():
        comments_text = "\n".join([f"- {item}" for item in items])
        if summary_type == "Report":
            messages = [
                {
                    'role': 'system',
                    'content': f"""
    You are a professional deliberation assistant and moderator for the AI4Deliberation group.
    Your task is to analyze forum comments and synthesize a formal report in the same language as the comments.
    You must remain neutral and objective."""
                },
                {
                    'role':'user',
                    'content':f"""
    Please analyze the following comments from a discussion cluster and provide a detailed report structured strictly into the following four sections. 
    Use formal language and bullet points for each section. If there is no information for a specific section, write 'None identified'. The language must be
    the same as the comments (e.g Greek Comments -> Greek Report)
    1. **What should be implemented to the article**: (List new ideas or features suggested by the users).
    2. **What shouldn't be implemented to the article**: (List points of disagreement or things users explicitly rejected).
    3. **General proposals**: (Broad suggestions, conceptual ideas, or meta-comments about the topic).
    4. **What should change to the current article**: (Specific corrections, modifications, or updates to existing content).
    Comments to analyze:
    {comments_text}
    Report:
                    """
                }
            ]
        else:
            messages = [
                {
                    'role': 'system',
                    'content': f"""
            You are a professional deliberation assistant and moderator for the AI4Deliberation group.
            Your task is to analyze forum comments and synthesize a formal report in the same language as the comments.
            You must remain neutral and objective."""
                },
                {
                    'role': 'user',
                    'content': f"""
Read the following comments carefully.
1. Identify the main topics discussed and group them into categories (e.g., criticism, personal experiences, positive points).
2. From each category, keep the most representative arguments without repeating details.
3. Present the summary in a logical flow:
	- first the general tone (e.g., positive/negative),
	- then the main topics discussed,
	- and finally a brief conclusion about the overall tone of the comments                	
4. Be neutral and objective, without emotional expressions from commenters (e.g., "get serious" → "criticism of the government").
5. The summary should be in Greek language and as many paragraphs as necessary to cover all topics.
COMMENTS:
{comments_text}
"""
                }
            ]
        data = client.chat(modelId, messages, stream=False)
        summaries.append(data['message']['content'])
    return summaries
