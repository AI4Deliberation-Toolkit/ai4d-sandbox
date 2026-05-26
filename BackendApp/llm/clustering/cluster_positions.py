import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity


def get_embeddings(texts, client):
    """Βοηθητική συνάρτηση για τη δημιουργία embeddings από μια λίστα κειμένων."""
    embeddings = []
    for text in texts:
        response = client.embeddings(model='nomic-embed-text-v2-moe:latest', prompt=text)
        embeddings.append(response['embedding'])
    return np.array(embeddings)


def cosine_distance_matrix(embeddings):
    """Μετατρέπει cosine similarity σε distance matrix (1 - similarity)."""
    sim = cosine_similarity(embeddings)
    dist = np.clip(1.0 - sim, 0.0, 2.0)
    return dist


def agglomerative_clusters(embeddings, threshold=0.25):
    """Επιστρέφει cluster labels χρησιμοποιώντας Agglomerative Clustering."""
    n = len(embeddings)
    if n == 1:
        return np.array([0])

    dist_matrix = cosine_distance_matrix(embeddings)

    clustering = AgglomerativeClustering(
        n_clusters=None,
        metric='precomputed',
        linkage='average',
        distance_threshold=threshold
    )
    return clustering.fit_predict(dist_matrix)


def _sort_comment_ids(ids_list):
    """Βοηθητική συνάρτηση για ταξινόμηση αριθμητικών IDs αν είναι δυνατόν."""
    try:
        return sorted(list(set(ids_list)), key=lambda x: int(x))
    except ValueError:
        return sorted(list(set(ids_list)))


def clustering_pos_and_args(results, model_id, client,
                            pos_threshold=0.65, arg_threshold=0.65):
    """
    Δέχεται {"positions": [{"label": ..., "amendment_type": ..., "arguments": [...]}]}
    Επιστρέφει {"positions": [...]} με clustered positions.
    """
    positions_list = results.get("positions", [])
    if not positions_list:
        print("Δεν βρέθηκαν θέσεις προς ανάλυση.")
        return {"positions": []}

    position_labels = [p["label"] for p in positions_list]

    total_args_before = sum(len(p.get("arguments", [])) for p in positions_list)
    print(f"\n[DEBUG] Πριν: {len(positions_list)} positions, {total_args_before} arguments συνολικά")

    # ── 1. Clustering Positions ──────────────────────────────────────────────
    pos_embeddings = get_embeddings(position_labels, client)
    pos_labels = agglomerative_clusters(pos_embeddings, threshold=pos_threshold)
    n_pos_clusters = len(set(pos_labels))

    clustered_positions = []
    print("\n--- ΞΕΚΙΝΑΕΙ ΤΟ CLUSTERING ---")

    for i in range(n_pos_clusters):
        cluster_positions = [positions_list[j] for j, lbl in enumerate(pos_labels) if lbl == i]
        cluster_labels_text = [p["label"] for p in cluster_positions]

        # Τίτλος cluster από LLM
        messages = [{
            "role": "user",
            "content": (
                f"Δώσε έναν περιεκτικό τίτλο για τα παρακάτω. "
                f"###ΣΗΜΑΝΤΙΚΟ: ΜΗΝ ΜΟΥ ΔΩΣΕΙΣ ΠΡΟΤΑΣΕΙΣ Ή ΤΟΝ ΤΡΟΠΟ ΣΚΕΨΗΣ ΣΟΥ, ΜΟΝΟ ΤΟΝ ΤΙΤΛΟ"
                f"**Η γλώσσα να είναι οπωσδήποτε η ίδια με το input**: "
                f"{', '.join(cluster_labels_text)}"
            )
        }]
        response = client.chat(model=model_id, messages=messages, stream=False)
        pos_title = response['message']['content'].strip()

        # amendment_type: πλειοψηφία από το cluster
        amendment_types = [p.get("amendment_type") for p in cluster_positions if p.get("amendment_type")]
        amendment_type = max(set(amendment_types), key=amendment_types.count) if amendment_types else None

        print(f"\n[CLUSTER ΘΕΣΗΣ] '{pos_title}'")
        print(f"   ↳ Προήλθε από: {cluster_labels_text}")

        # Συγκεντρώνουμε όλα τα arguments από τα positions του cluster
        cluster_args = []
        for pos in cluster_positions:
            cluster_args.extend(pos.get("arguments", []))

        # ── 2. Clustering Arguments ──────────────────────────────────────────
        clustered_args = []
        if len(cluster_args) >= 2:
            arg_texts = [a["label"] for a in cluster_args]
            arg_embeddings = get_embeddings(arg_texts, client)
            arg_labels_arr = agglomerative_clusters(arg_embeddings, threshold=arg_threshold)
            n_arg_clusters = len(set(arg_labels_arr))

            for k in range(n_arg_clusters):
                args_in_k = [cluster_args[j] for j, lbl in enumerate(arg_labels_arr) if lbl == k]
                arg_texts_in_k = [a["label"] for a in args_in_k]

                arg_messages = [{
                    "role": "user",
                    "content": (
                        f"Δώσε έναν περιεκτικό τίτλο για τα παρακάτω επιχειρήματα. "
                        f"###ΣΗΜΑΝΤΙΚΟ: ΜΗΝ ΜΟΥ ΔΩΣΕΙΣ ΠΡΟΤΑΣΕΙΣ Ή ΤΟΝ ΤΡΟΠΟ ΣΚΕΨΗΣ ΣΟΥ, ΜΟΝΟ ΤΟΝ ΤΙΤΛΟ"
                        f"**Η γλώσσα να είναι οπωσδήποτε η ίδια με το input**: "
                        f"{', '.join(arg_texts_in_k)}"
                    )
                }]
                arg_response = client.chat(model=model_id, messages=arg_messages, stream=False)
                arg_title = arg_response['message']['content'].strip()

                # polarity: πλειοψηφία
                polarities = [a.get("polarity") for a in args_in_k if a.get("polarity")]
                polarity = max(set(polarities), key=polarities.count) if polarities else "positive"

                print(f"       • [ΕΠΙΧΕΙΡΗΜΑ] '{arg_title}' (polarity: {polarity})")
                clustered_args.append({
                    "label": arg_title,
                    "polarity": polarity,
                })

        elif len(cluster_args) == 1:
            clustered_args.append({
                "label": cluster_args[0]["label"],
                "polarity": cluster_args[0].get("polarity", "positive"),
            })

        clustered_positions.append({
            "label": pos_title,
            "amendment_type": amendment_type,
            "arguments": clustered_args,
        })

    print("\n==============================================")
    total_args_after = sum(len(p["arguments"]) for p in clustered_positions)
    print(f"[DEBUG] ΤΕΛΙΚΟ: {len(clustered_positions)} positions, {total_args_after} arguments")
    print("==============================================\n")

    return {"positions": clustered_positions}
