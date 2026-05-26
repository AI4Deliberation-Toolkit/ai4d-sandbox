from langchain_ollama import ChatOllama

def calculate_tokens(comments, llm, url):
    batches = []
    batch = []
    all_tokens = 0

    llm = ChatOllama(
        base_url=url,
        model=llm,
        temperature=0,
    )

    print(comments[0])
    for data in comments:
        if data.get('Σχόλιο'):
            key = 'Σχόλιο'
        else:
            key = 'Comment'
        for comment in data[key]:
            tokens = llm.get_num_tokens(comment)
            if all_tokens + tokens <= 10000:
                all_tokens += tokens
                batch.append(comment)
            else:
                batches.append(batch)
                batch = [comment]
                all_tokens = tokens

    if batch:
        batches.append(batch)

    return batches


def get_tokens(summaries, llm, url):
    llm = ChatOllama(
        base_url=url,
        model=llm,
        temperature=0,
    )

    tokens = 0
    for summary in summaries:
        tokens += llm.get_num_tokens(summary)

    return tokens
