import json
import re
import requests

def final_summary(summaries, modelId, summary_type, client):
    all_reports = "\n--- NEXT REPORT ---\n".join(summaries)
    if summary_type == "Report":
        print("Report type")
        messages = [
            {
                'role': 'system',
                'content': f"""
    You are the Lead Synthesis Officer of the AI4Deliberation group.
    Your task is to take multiple sub-reports and merge them into one final,
    comprehensive, and coherent executive summary.
    """
            },
            {
                'role':'user',
                'content':f"""
    Below are several reports generated from different comment clusters. 
    Your goal is to synthesize them into a single, unified, and formal document.
    Instructions:
    1. **Consolidate & Deduplicate**: If the same suggestion appears in multiple reports, merge it into one point. Do not repeat the same information.
    2. **Structure**: Organize the final text strictly under the following 4 headers:
        - a **Implementation Recommendations** (What should be implemented)
        - b **Points of Rejection** (What shouldn't be implemented)
        - c **General Proposals & Strategic Ideas**
        - d️ **Required Modifications to Current Content** (What should change)
    3. **Format**: Use a mix of professional prose for introductions and bullet points for clarity. You may use tables if it helps compare different viewpoints.
    4. **Language**: The entire output MUST be in the same language as the input reports.
    5. **Tone**: Maintain a neutral, formal, and objective tone.
    Reports to synthesize:
    {all_reports}
    Final Coherent Report:
    """
            }
        ]
    else:
        print("Summary type")
        messages = [
            {
                'role': 'system',
                'content': f"""
        You are the Lead Synthesis Officer of the AI4Deliberation group.
        Your task is to take multiple sub-reports and merge them into one final,
        comprehensive, and coherent executive summary.
        """
            },
            {
                'role': 'user',
                'content': f"""
Create a coherence Text from the following reports.
1. Read all the reports carefully and don't summarize or delete anything.
{all_reports}
        """
            }
        ]
    data = client.chat(modelId, messages, stream=False)
    return data['message']['content']
