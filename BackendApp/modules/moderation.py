from detoxify import Detoxify
from llm.moderation.llama_guard import llama_guard
from llm.moderation.claude import ollama_moderation

def moderations(comment, client):
    print('Original Pipeline')
    model = Detoxify('original')
    unsafe_field = ['S', 'H', 'V', 'HR', 'SH', 'S3', 'H2', 'V2']
    detoxify_category = ['toxicity', 'severe_toxicity', 'obscene', 'threat', 'insult', 'identity_attack']
    print(comment)
    # First stage
    detoxify_response = model.predict(comment)
    if any(detoxify_response[field] > 0.5 for field in detoxify_category):
        is_it_flagged = True
    else:
        is_it_flagged = False
    print('Stage 1 Completed')
    if not is_it_flagged:
        llama_response = llama_guard(comment, client= client)
        if ('unsafe' in llama_response):
            is_it_flagged = True
    print('Stage 2 Completed')
    if not is_it_flagged:
        claude_response = ollama_moderation(comment, client= client)
        if ('unsafe' in claude_response):
            is_it_flagged = True
    print('Stage 3 Completed')
    return is_it_flagged

def without_detoxify(comment, client):
    print("Without Detoxify")
    is_it_flagged = False
    llama_response = llama_guard(comment, client= client)
    if ('unsafe' in llama_response):
        is_it_flagged = True
    if not is_it_flagged:
        claude_response = ollama_moderation(comment, client= client)
        if ('unsafe' in claude_response):
            is_it_flagged = True
    return is_it_flagged

def only_llm(comment, client):
    print("Only LLM")
    is_it_flagged = False
    claude_response = ollama_moderation(comment, client= client)
    if ('unsafe' in claude_response):
        is_it_flagged = True
    return is_it_flagged
