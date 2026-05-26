import json
import requests
from pyexpat.errors import messages


def relevance_ollama(article, comment, client):

    messages = [
        {
            'role': 'user',
            'content': f"""
            You are an assistant that is meant to act is a deliberation tool and moderate online forums and debates. You are associated with the AI4Deliberation group with the sole purpose of analyzing the articles and comments that are given to you, providing ratings and summaries of debates and deliberations, "
            "and synthesizing reports
            Look at the relevance of the <comment>, given relative to the {article} that they are assigned to based on the parameters listed below, and provide a score out of 100 for not only 
            how they progress deliberation on the matter but also relate to the topic and overall discussion of the article itself.
        
            <comment>
            {comment}
        
            You will be given:
            1. Only the total score an int. Total score is the {{sum}} of the scores that will get for each category bellow.
        
            You must produce, in order:
        
            **Α. Comment Evaluation & Scoring**  
            For each comment, assign a **Relevance Score** out of 100 according to these parameters:
            1. **Topical Focus (0–30)**  
               - +points for precision and depth on the article’s topic.  
               - +bonus if it introduces a related subtopic.  
               - –penalty if off-topic or irrelevant; mark “Remove” if completely unrelated.
            2. **Evidence Introduction (0–25)**  
               - +points if it brings new, relevant evidence.  
               - +bonus for expanding discussion into novel areas.
            3. **Evidence Validity (0–20)**  
               - +points if factually correct.  
               - –points if demonstrably false (cite a counter-source).
            4. **Engagement Impact (0–15)**  
               - +points if others reply or engage with the comment.  
               - If no engagement, score 0 here but do not penalize overall.
            5. **Originality (0–10)**  
               - +points if the idea is unique in the thread.  
               - –points if it repeats earlier arguments.
        
            return only the total score without any comments or explanations. If the comment is completely irelevant score it with 0. 
        
            1st Example of output:
            0 
            2nd Example of output:
            29
            """
        }
    ]

    data = client.chat("gemini-3-flash-preview:cloud", messages, stream=False)
    return data['message']['content']