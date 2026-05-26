import numpy as np
import json
from llm.clustering.cluster_comments import cluster_comments
from llm.relevance.relevance_claude import relevance_ollama
from llm.summarizations.batch_summary import batch_summary
from llm.summarizations.final_summary import final_summary
from utils.calculate_tokens import calculate_tokens
from modules.information_extr import information_extr_ol
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

MODEL = "bge-m3:latest"
SIMILARITY_THRESHOLD = 0.5
TEXT_CHUNK_LIMIT = 8192

def get_embedding(text, base_url):
    text = text.strip()[:TEXT_CHUNK_LIMIT]
    if not text:
        return None
    try:
        response = requests.post(
            f"{base_url}/api/embed",
            json={"model": MODEL, "input": text},
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        if "embeddings" in data:
            return data["embeddings"][0]
        return  data["embedding"][0]
    except requests.RequestException as e:
        print(f"Failed to get embedding: {e}")
        return None

def cosine_similarity(vec_a, vec_b):
    a = np.array(vec_a)
    b = np.array(vec_b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)

def get_comment_text(comment):
    if isinstance(comment, dict):
        return comment.get("comment", "") or comment.get("text", "") or str(comment)
    elif isinstance(comment, str):
        return comment
    return str(comment)

def summaries(comments, context_content, llm, base_url, summary_type, wp_positions, client):
    if wp_positions is not None:
        print("[DEBUG] -> WP_POSITIONS", flush=True)
        context_emb = get_embedding(context_content, base_url)
        if context_emb is None:
            print("Could not embed article", flush=True)

        positions_dict = {}
        for entry in wp_positions:
            for pos in entry.get("positions", []):
                label = pos.get("label", "")
                if not label:
                    continue

                pos_emb = get_embedding(label, base_url)
                if pos_emb:
                    similarity = cosine_similarity(context_emb, pos_emb)
                    print(f"[DEBUG] Position '{label}' similarity: {similarity:.3f}", flush=True)
                    if similarity < SIMILARITY_THRESHOLD:
                        print(f"[DEBUG] Skipping position '{label}' (below threshold)", flush=True)
                        continue

                if label not in positions_dict:
                    positions_dict[label] = []

                for arg in pos.get("arguments", []):
                    arg_text = arg.get("text", "")
                    if arg_text:
                        positions_dict[label].append({"label": arg_text})

        print(f"[DEBUG] positions_dict after filtering: {positions_dict}", flush=True)

    else:
        context_emb = get_embedding(context_content, base_url)
        if context_emb is None:
            print("Could not embed article", flush=True)

        def _embed_and_filter(comment):
            comment_text = get_comment_text(comment)
            comment_emb = get_embedding(comment_text, base_url)
            if comment_emb:
                similarity = cosine_similarity(context_emb, comment_emb)
                if similarity >= SIMILARITY_THRESHOLD:
                    return comment
            return None

        with ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(_embed_and_filter, comments))

        filtered_comments = [r for r in results if r is not None]

        positions_json = information_extr_ol(filtered_comments, llm, base_url)
        positions_dict = json.loads(positions_json) if isinstance(positions_json, str) else positions_json

        # Shared path — αμετάβλητο
    positions = []
    for key, value in positions_dict.items():
        positions.append(key)
        for v in value:
            if v.get('label'):
                positions.append(v['label'])

    print(f"[DEBUG] Total positions for clustering: {len(positions)}", flush=True)

    report = None
    if positions:
        clusters = cluster_comments(positions)
        reports = batch_summary(clusters, llm, summary_type, client=client)
        report = final_summary(reports, llm, summary_type, client=client)

    print(report, flush=True)
    return report