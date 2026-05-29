
# Public Consultation Analysis & Moderation Plugins

An AI-powered suite of plugins designed to assist administrators, moderators, and users in managing, analyzing, and synthesizing public consultation comments. The suite consists of three distinct components: **Summary**, **Information Extraction**, and **Moderation**.

---

## Supported Media Types
All plugins are designed to process comments submitted in the following formats:
*   **Text**
*   **Audio**
*   **Video**

---

## 1. Summary Plugin

The **Summary** plugin gathers all submitted comments from a consultation and organizes them into a concise, structured summary. Once the analysis is complete, the final summary is made available for users to view or download.

### Workflow
1. **Input Collection:** The plugin accepts comments in text, audio, or video formats.
2. **Context Alignment:** Comments are compiled alongside the primary consultation text.
3. **Embedding Generation:** Vector embeddings are generated for both the comments and the main consultation text.
4. **Relevance Filtering:** Using **Cosine Similarity**, the plugin evaluates the relevance of each comment, filtering out off-topic submissions.
5. **Theme Identification:** The system detects key themes and core arguments within the remaining comments.
6. **Clustering:** Similar arguments and perspectives are automatically grouped together.
7. **Sub-reporting:** A brief report is generated for each cluster of comments.
8. **Aggregation:** Individual cluster reports are merged into a single cohesive summary outlining the main conclusions of the consultation.

<img width="1536" height="346" alt="image-1-1536x346" src="https://github.com/user-attachments/assets/d5bd0c79-40cc-4e78-b456-5aac46236502" />

---

## 2. Information Extraction Plugin

The **Information Extraction** plugin utilizes Artificial Intelligence to identify the main points and core positions expressed in the consultation. It generates concise bullet points for individual comments and provides a structured overview of the collective feedback.

### Workflow
1. **Input Submission:** The plugin receives comments in text, audio, or video formats.
2. **Processing:** The comments are securely routed to the backend for processing.
3. **Core Argument Extraction:** The AI identifies key positions using the **IBIS (Issue-Based Information System)** model.
4. **Clustering:** Similar viewpoints and issues are automatically grouped together.
5. **Reporting:** A final report is generated, presenting a structured overview of the most significant points and conclusions.

<img width="1536" height="507" alt="image-2-1536x507" src="https://github.com/user-attachments/assets/7b292919-5e62-4fda-b925-39c7765d6617" />

---

## 3. Moderation Plugin

The **Moderation** plugin is an administrative tool restricted to Admins and Moderators. It automatically evaluates incoming comments, classifying them as either **"Clean"** (safe for publication) or **"Flagged"** (requiring human review).

### Workflow
1. **Input Ingestion:** The plugin receives incoming comments in text, audio, or video formats.
2. **Pipeline Selection:** The administrator selects the analytical pipeline (moderation method) to be applied.
3. **Evaluation:** The comment is assessed and labeled as either **Clean** or **Flagged**.
4. **Explanation Generation:** The system produces a brief explanation justifying the classification decision.
5. **Dashboard Delivery:** The final classification and its justification are displayed in the moderation dashboard for administrator action.

<img width="420" height="600" alt="image-3" src="https://github.com/user-attachments/assets/5e482713-e8c8-41d4-be29-198676e22ae8" />
