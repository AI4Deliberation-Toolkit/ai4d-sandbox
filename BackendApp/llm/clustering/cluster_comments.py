from mpmath.libmp import normalize
from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from ollama import chat, Client

def cluster_comments(comments, n_clusters: int = None, min_cluster_size: int = 2):
    if not comments:
        print("No comments provided")
        return {}

    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    embeddings = model.encode(comments, normalize_embeddings=True)

    if len(comments) < min_cluster_size:
        print("Not enough comments to cluster")
        return {0: comments}

    if n_clusters is None:
        max_k = min(10, len(comments) - 1)
        best_k, best_score = 2, -1
        for k in range(2, max_k + 1):
            km = KMeans(n_clusters=k, random_state=42, n_init="auto")
            labels = km.fit_predict(embeddings)
            score = silhouette_score(embeddings, labels)
            if score > best_score:
                best_score, best_k = score, k
        n_clusters = best_k

    km = KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")
    labels = km.fit_predict(embeddings)
    clusters: dict[int, list[str]] = {}
    for msg, label in zip(comments, labels):
        clusters.setdefault(int(label), []).append(msg)

    return clusters