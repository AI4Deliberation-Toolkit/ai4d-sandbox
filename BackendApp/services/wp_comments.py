import requests
import json
from requests.auth import HTTPBasicAuth


def get_live_analysis(post_id, site_url, username, app_password):
    """
    Ανακτά τα σχόλια και την ανάλυσή τους μέσω του WordPress REST API.
    """
    api_url = f"{site_url.rstrip('/')}/wp-json/wp/v2/comments"
    print(f"---> [DEBUG] Calling WP API: {api_url} for post {post_id}", flush=True)

    params = {
        "post": post_id,
        "per_page": 100,
        "status": "approve"
    }

    output_data = []

    try:
        # ΠΡΟΣΘΗΚΗ timeout=20 για να μην κολλάει αν το site αργεί
        response = requests.get(
            api_url,
            params=params,
            auth=HTTPBasicAuth(username, app_password),
            timeout=20
        )

        print(f"---> [DEBUG] WP API Response Status: {response.status_code}", flush=True)
        response.raise_for_status()
        comments = response.json()

        for c in comments:
            comment_id = c.get('id')

            # Εδώ παίρνουμε το πεδίο που προσθέσαμε στο PHP (ai4d_analysis)
            raw_analysis = c.get('ai4d_analysis')

            if not raw_analysis:
                continue

            # Μετατροπή σε dict αν είναι string, αλλιώς χρήση ως έχει
            if isinstance(raw_analysis, str):
                try:
                    raw_analysis = json.loads(raw_analysis)
                except:
                    continue

            positions_list = raw_analysis.get('positions', raw_analysis) if isinstance(raw_analysis,
                                                                                       dict) else raw_analysis

            comment_entry = {
                "comment_id": comment_id,
                "positions": []
            }

            if isinstance(positions_list, list):
                for p in positions_list:
                    pos_data = {
                        "label": p.get('label', 'N/A'),
                        "arguments": []
                    }
                    for arg in p.get('arguments', []):
                        pos_data["arguments"].append({
                            "text": arg.get('label', ''),
                            "polarity": arg.get('polarity', 'positive')
                        })
                    comment_entry["positions"].append(pos_data)

            output_data.append(comment_entry)

    except Exception as e:
        print(f"---> [ERROR] get_live_analysis failed: {e}", flush=True)

    print(f"---> [DEBUG] Total comments with analysis found: {len(output_data)}", flush=True)
    return output_data