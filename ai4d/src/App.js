import React, { useState, useEffect } from 'react';
import { Languages, Shield, ArrowRight, CheckCircle, AlertTriangle, BookOpenText, FileSearch2, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';
import logo from './assets/1000X600_TRANSPARENT-01.png'

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || window.location.origin.replace(':3000', ':8000');
const API_KEY = process.env.REACT_APP_API_KEY;
const VIDEO_API_BASE_URL = process.env.REACT_APP_VIDEO_API_BASE_URL || window.location.origin.replace(':3000', ':8001');

function App() {
  // Inputs
  const [translationText, setTranslationText] = useState('');
  const [moderationText, setModerationText] = useState('');
  const [summaryContextText, setSummaryContextText] = useState('');
  const [summaryContextFile, setSummaryContextFile] = useState(null);
  const [summaryCommentsFile, setSummaryCommentsFile] = useState(null);
  const [informationExtractionFile, setInformationExtractionFile] = useState(null);
  const [translationMediaFile, setTranslationMediaFile] = useState(null);
  const [moderationMediaFile, setModerationMediaFile] = useState(null);
  const [summaryMediaFile, setSummaryMediaFile] = useState(null);
  const [informationExtractionMediaFile, setInformationExtractionMediaFile] = useState(null);
  const [whisperModelSize, setWhisperModelSize] = useState('small');

  // Loadings
  const [translationLoading, setTranslationLoading] = useState(false);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [informationExtractionLoading, setInformationExtracttionLoading] = useState(false)
  const [llms, setLlms] = useState([])
  const [pipelines, setPipelines] = useState([])
  const [summaryLLMS, setSummaryLLMS] = useState([])
  const [extractionLLMS, setExtractionLMS] = useState([])

  // Results
  const [translationResult, setTranslationResult] = useState(null);
  const [moderationResult, setModerationResult] = useState(null);
  const [summaryResult, setSummaryResult] = useState(null)
  const [informationExtractionResult, setInformationExtractionResult] = useState({})
  const [summaryError, setSummaryError] = useState(null);

  // Video generation
  const [videoJobId, setVideoJobId] = useState(null);
  const [videoStatus, setVideoStatus] = useState(null); // null | 'pending' | 'processing' | 'done' | 'error'
  const [videoError, setVideoError] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);

  // Selections
  const [selectedLLM, setSelectedLLM] = useState('gemini-3-flash-preview:cloud');
  const [selectedPipeline, setSelectedPipeline] = useState('Detoxify -> llama_guard -> LLM');
  const [selectedSummaryPipeline, setSelectedSummaryPipeline] = useState('gemini-3-flash-preview:cloud');
  const [selectedExtrPipeline, setExtrPipeline] = useState('gemini-3-flash-preview:cloud');
  const [fromLanguage, setFromLanguage] = useState('English');
  const [toLanguage, setToLanguage] = useState('Greek');
  const [summaryPipelines, setSummaryPipelines] = useState([]);
  const [selectedSummaryOption, setSelectedSummaryOption] = useState('Report'); 

  // Fact-checking
  const [factCheckResult, setFactCheckResult] = useState(null);
  const [factCheckLoading, setFactCheckLoading] = useState(false);
  const [factCheckError, setFactCheckError] = useState(null);
  const [factCheckModal, setFactCheckModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // const url = new URL(`${API_BASE_URL}/get_llms`);
        const response = await fetch(`${API_BASE_URL}/get_llms`, {
          method: 'GET',
          headers: { 'ai4d': API_KEY }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setLlms(data.llms);
      } catch (error) { console.error("Translation failed:", error); }
    };

    const fetchPipeline = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/get_pipelines`, {
          method: 'GET',
          headers: { 'ai4d': API_KEY }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setPipelines(data.pipelines)
      } catch (error) { console.error("Moderation Pipeline Failed", error); }
    }

    const fetchSummaryPipeline = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/get_summary_pipelines`, {
          method: 'GET',
          headers: { 'ai4d': API_KEY }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log("Summary Pipelines:", data.summary_pipelines);
        setSummaryPipelines(data.summary_pipelines)
      } catch (error) { console.error("Summary Pipeline Failed", error); }
    }

    const fetchSummaryLLMS = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/get_llms`, {
          method: 'GET',
          headers: { 'ai4d': API_KEY }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setSummaryLLMS(data.llms)
      } catch (error) { console.error("Summary Pipeline Failed", error); }
    }

    const fetchExtractionLLMS = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/get_llms`, {
          method: 'GET',
          headers: { 'ai4d': API_KEY }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setExtractionLMS(data.llms)
      } catch (error) { console.error("Extraction Pipeline Failed", error); }
    }

    fetchData();
    fetchPipeline();
    fetchSummaryPipeline();
    fetchSummaryLLMS();
    fetchExtractionLLMS();
  }, []);

  // Poll video status when a job is running
  useEffect(() => {
    if (!videoJobId || videoStatus === 'done' || videoStatus === 'error') return;

    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`${VIDEO_API_BASE_URL}/status/${videoJobId}`);
        const data = await resp.json();
        setVideoStatus(data.status);
        if (data.status === 'done' || data.status === 'error') {
          setVideoLoading(false);
          if (data.error) setVideoError(data.error);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Video polling error:', err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [videoJobId, videoStatus]);

  const handleTranslate = async () => {
    if (!translationText.trim() && !translationMediaFile) return;
    setTranslationLoading(true);
    setTranslationResult(null);
    try {
      const formData = new FormData();
      formData.append('llm', selectedLLM);
      formData.append('model_size', whisperModelSize); // Always appended securely to prevent routing errors

      if (translationText.trim()) formData.append('comment', translationText);
      if (selectedLLM !== 'LibreTranslate') {
        formData.append('from_language', fromLanguage);
        formData.append('to_language', toLanguage);
      }
      if (translationMediaFile) {
        formData.append('media_file', translationMediaFile);
      }

      const response = await fetch(`${API_BASE_URL}/translation`, {
        method: 'POST',
        headers: { 'ai4d': API_KEY },
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      setTranslationResult({
        original: data.source_text || translationText,
        translated: data.translation,
        language: data.detected_language
          ? `Detected: ${data.detected_language}`
          : selectedLLM === 'LibreTranslate'
            ? 'Auto-Detected'
            : `${fromLanguage} to ${toLanguage}`,
      });
    } catch (error) {
      console.error("Translation failed:", error);
      setTranslationResult({ original: translationText, translated: "An error occurred during translation." });
    } finally {
      setTranslationLoading(false);
    }
  };

  const handleModeration = async () => {
    if (!moderationText.trim() && !moderationMediaFile) return;
    setModerationLoading(true);
    setModerationResult(null);

    try {
      const formData = new FormData();
      formData.append('pipeline', selectedPipeline);
      formData.append('model_size', whisperModelSize);

      if (moderationText.trim()) formData.append('comment', moderationText);
      if (moderationMediaFile) {
        formData.append('media_file', moderationMediaFile);
      }

      const response = await fetch(`${API_BASE_URL}/moderation`, {
        method: 'POST',
        headers: { 'ai4d': API_KEY },
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      setModerationResult({
        status: data.is_it_flagged ? 'flagged' : 'approved',
        detectedLanguage: data.detected_language || null,
        explanation: data.explanation || 'Something Went Wrong',
      });
    } catch (error) {
      console.error("Moderation failed:", error);
      setModerationResult({ status: "error" });
    } finally {
      setModerationLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!summaryCommentsFile && !summaryMediaFile) return;
    if (!summaryContextText.trim() && !summaryContextFile) return;

    setSummaryLoading(true);
    setSummaryResult(null);
    setSummaryError(null);

    try {
      const formData = new FormData();
      formData.append('llm', selectedSummaryPipeline);
      formData.append('model_size', whisperModelSize);
      formData.append('summary_type', selectedSummaryOption);
      if (summaryCommentsFile) formData.append('comments_file', summaryCommentsFile);
      if (summaryMediaFile) {
        formData.append('media_file', summaryMediaFile);
      }
      if (summaryContextFile) {
        formData.append('context_file', summaryContextFile);
      } else {
        formData.append('context_text', summaryContextText);
      }
      console.log(formData)
      const response = await fetch(`${API_BASE_URL}/summary`, {
        method: 'POST',
        headers: { 'ai4d': API_KEY },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      setSummaryResult(data);
    } catch (error) {
      console.error("Summarization failed:", error);
      setSummaryError(error.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleInformationExtraction = async () => {
    if (!informationExtractionFile && !informationExtractionMediaFile) return;

    setInformationExtracttionLoading(true);
    setInformationExtractionResult({});

    try {
      const formData = new FormData();
      formData.append('llm', selectedExtrPipeline);
      formData.append('model_size', whisperModelSize);

      if (informationExtractionFile) formData.append('comments_file', informationExtractionFile);
      if (informationExtractionMediaFile) {
        formData.append('media_file', informationExtractionMediaFile);
      }

      const response = await fetch(`${API_BASE_URL}/information_extraction`, {
        method: 'POST',
        headers: { 'ai4d': API_KEY },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      setInformationExtractionResult(typeof data === 'string' ? JSON.parse(data) : data);
    } catch (error) {
      console.error("Information extraction failed:", error);
    } finally {
      setInformationExtracttionLoading(false);
    }
  };

  const handleContextTextChange = (e) => {
    setSummaryContextText(e.target.value);
    if (summaryContextFile) {
      setSummaryContextFile(null);
      document.getElementById('summary-context-file-input').value = '';
    }
  };

  const handleContextFileChange = (e) => {
    setSummaryContextFile(e.target.files[0]);
    if (summaryContextText) {
      setSummaryContextText('');
    }
  };

  const handleLLMSelectChange = (e) => setSelectedLLM(e.target.value)
  const handlePipelineSelectChange = (e) => setSelectedPipeline(e.target.value)
  const handleSummarySelectChange = (e) => setSelectedSummaryPipeline(e.target.value)
  const handleFromLanguageChange = (e) => setFromLanguage(e.target.value);
  const handleToLanguageChange = (e) => setToLanguage(e.target.value);
  const handleExtractionSelectChange = (e) => setExtrPipeline(e.target.value)
  const handleSummarySelectionChange = (e) => setSelectedSummaryOption(e.target.value)

  const handleGenerateVideo = async () => {
    if (!summaryResult) return;
    const summaryText = typeof summaryResult === 'string' ? summaryResult : JSON.stringify(summaryResult);
    setVideoJobId(null);
    setVideoStatus(null);
    setVideoError(null);
    setVideoLoading(true);
    try {
      const videoResp = await fetch(`${VIDEO_API_BASE_URL}/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: summaryText }),
      });
      const videoData = await videoResp.json();
      setVideoJobId(videoData.job_id);
      setVideoStatus(videoData.status);
    } catch (videoErr) {
      console.error('Video generation trigger failed:', videoErr);
      setVideoLoading(false);
      setVideoError('Αποτυχία εκκίνησης παραγωγής βίντεο.');
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoJobId) return;
    try {
      await fetch(`${VIDEO_API_BASE_URL}/cleanup/${videoJobId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Video cleanup error:', err);
    } finally {
      setVideoJobId(null);
      setVideoStatus(null);
      setVideoError(null);
    }
  };

  const handleFactCheck = (label) => async (e) => {
    e.stopPropagation(); // αποφυγή bubble σε parent events

    setFactCheckResult(null);
    setFactCheckError(null);
    setFactCheckLoading(true);
    setFactCheckModal(true);

    try {
      const params = new URLSearchParams({ comment: label });
      const response = await fetch(`${API_BASE_URL}/fact_checking?${params}`, {
        method: "POST",
        headers: {
          "ai4d": "ssWTusBwSZujqq8T3gswAcQ6KuTyXNuTQNWvdr_Z0Z4sx6xrpbfyz8HoRw",
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Σφάλμα κατά το fact-check.");
      }

      const data = await response.json();
      setFactCheckResult(data);
    } catch (err) {
      setFactCheckError(err.message);
    } finally {
      setFactCheckLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-[200px] h-10 flex items-center justify-center">
                <img src={logo} alt="Logo" className='w-[200px] h-[150px]' />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Content Tools</h1>
                <p className="text-xs text-slate-500">Professional Translation & Moderation</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium">Whisper model:</span>
              <select
                value={whisperModelSize}
                onChange={(e) => setWhisperModelSize(e.target.value)}
                className="px-2 py-1 border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 rounded"
              >
                {['tiny', 'base', 'small', 'medium', 'large'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-6">

          {/* Translation Section */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <Languages className="w-5 h-5 text-slate-700" />
                <h1 className="text-lg font-semibold text-slate-900">Translation Service</h1>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label htmlFor="llm-select" className="block text-sm font-medium text-slate-700 mb-2">
                  Translation Model
                </label>
                <select id="llm-select" value={selectedLLM} onChange={handleLLMSelectChange} className="px-2 py-1 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none">
                  {llms.map((llm) => (
                    <option key={llm} value={llm}>{llm}</option>
                  ))}
                </select>
              </div>
              {selectedLLM !== 'LibreTranslate' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="from-lang-input" className="block text-sm font-medium text-slate-700 mb-2">
                      From Language
                    </label>
                    <input
                      id="from-lang-input"
                      type="text"
                      value={fromLanguage}
                      onChange={handleFromLanguageChange}
                      placeholder="e.g., English or en"
                      className="w-full px-3 py-2 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="to-lang-input" className="block text-sm font-medium text-slate-700 mb-2">
                      To Language
                    </label>
                    <input
                      id="to-lang-input"
                      type="text"
                      value={toLanguage}
                      onChange={handleToLanguageChange}
                      placeholder="e.g., Greek or el"
                      className="w-full px-3 py-2 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
              <label htmlFor="source-text" className="block text-sm font-medium text-slate-700 mb-2">
                Source Text
              </label>
              <textarea
                id="source-text"
                value={translationText}
                onChange={(e) => setTranslationText(e.target.value)}
                placeholder="Enter text to translate..."
                className="w-full h-32 px-3 py-2 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
              />

              <div className="mt-4">
                <div className="flex items-center my-3">
                  <div className="flex-grow border-t border-slate-300"></div>
                  <span className="flex-shrink mx-4 text-slate-500 text-sm">OR upload audio/video</span>
                  <div className="flex-grow border-t border-slate-300"></div>
                </div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Audio / Video File <span className="text-slate-400 font-normal">(optional — transcript will be translated)</span>
                </label>
                <input
                  type="file"
                  accept="video/*,audio/*"
                  onChange={(e) => setTranslationMediaFile(e.target.files[0] || null)}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer rounded-lg border border-slate-200"
                />
                {translationMediaFile && <p className="text-xs text-slate-500 mt-2">Selected: {translationMediaFile.name}</p>}
              </div>

              <button
                onClick={handleTranslate}
                disabled={(!translationText.trim() && !translationMediaFile) || translationLoading}
                className="mt-4 w-full bg-slate-900 text-white py-2.5 px-4 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {translationLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Translate
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {translationResult && (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-900 uppercase tracking-wide">
                      {translationResult.language}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{translationResult.translated}</p>
                </div>
              )}
            </div>
          </div>
          <hr className="border-t-2 border-slate-400" />
          {/* Moderation Section */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-slate-700" />
                <h1 className="text-lg font-semibold text-slate-900">Content Moderation</h1>
              </div>
            </div>

            <div className="p-6">
              <p>
                In content moderation, we read the comment provided and label it as either appropriate (unflagged) or inappropriate (flagged). From the dropdown menu, you can choose between three different methods.
              </p>
              <select id="pipeline-select" value={selectedPipeline} onChange={handlePipelineSelectChange} className="px-2 py-1 my-5 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none">
                {pipelines.map((pipeline) => (
                  <option key={pipeline} value={pipeline}>{pipeline}</option>
                ))}
              </select>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Content to Review
              </label>
              <textarea
                value={moderationText}
                onChange={(e) => setModerationText(e.target.value)}
                placeholder="Enter content for moderation..."
                className="w-full h-32 px-3 py-2 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
              />

              <div className="mt-4">
                <div className="flex items-center my-3">
                  <div className="flex-grow border-t border-slate-300"></div>
                  <span className="flex-shrink mx-4 text-slate-500 text-sm">OR upload audio/video</span>
                  <div className="flex-grow border-t border-slate-300"></div>
                </div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Audio / Video File <span className="text-slate-400 font-normal">(optional — transcript will be moderated)</span>
                </label>
                <input
                  type="file"
                  accept="video/*,audio/*"
                  onChange={(e) => setModerationMediaFile(e.target.files[0] || null)}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer rounded-lg border border-slate-200"
                />
                {moderationMediaFile && <p className="text-xs text-slate-500 mt-2">Selected: {moderationMediaFile.name}</p>}
              </div>

              <button
                onClick={handleModeration}
                disabled={(!moderationText.trim() && !moderationMediaFile) || moderationLoading}
                className="mt-4 w-full bg-slate-900 text-white py-2.5 px-4 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {moderationLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Analyze Content
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {moderationResult && (
                <div className={`mt-4 p-4 border ${moderationResult.status === 'approved'
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
                  }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {moderationResult.status === 'approved' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                    <span className={`text-xs font-medium uppercase tracking-wide ${moderationResult.status === 'approved' ? 'text-emerald-900' : 'text-amber-900'
                      }`}>
                      {moderationResult.status === 'approved' ? 'Approved' : 'Flagged'}
                      <br />
                      {moderationResult.explanation && ` - ${moderationResult.explanation}`}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed mb-2">{moderationResult.message}</p>
                  {moderationResult.detectedLanguage && (
                    <p className="text-xs text-slate-500 mb-2">Detected language: <span className="font-medium">{moderationResult.detectedLanguage}</span></p>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 h-1.5">
                      <div
                        className={`h-1.5 ${moderationResult.status === 'approved' ? 'bg-emerald-600' : 'bg-amber-600'}`}
                        style={{ width: `${moderationResult.score * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <hr className="border-t-2 border-slate-400" />
          {/* Summary Section */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <BookOpenText className="w-5 h-5 text-slate-700" />
                <h1 className="text-lg font-semibold text-slate-900">Summarization Service</h1>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <p>
                For the Summary, you must include:<br />
                1. The context to which the comments refer, this can be provided either as text or as a PDF. <br />
                2. A CSV file containing the comments. <br /><br />
                The CSV file <strong>must</strong> be structured as in the following <a href='https://docs.google.com/spreadsheets/d/1Oj-mgvvQ6oulAXa3CteeU5IYKSjCREcYJsLKchElpFk/edit?usp=sharing' className='text-cyan-800 font-bold'>csv example</a><br />
                The first column of the CSV contains the article’s title, and the second column contains the comments for that specific article.
              </p>
              <select id="summary-select" value={selectedSummaryPipeline} onChange={handleSummarySelectChange} className="px-2 py-1 my-5 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none">
                {summaryLLMS.map((llm) => (
                  <option key={llm} value={llm}>{llm}</option>
                ))}
              </select>
              <select id="pipelineSummary-select" value={selectedSummaryOption} onChange={handleSummarySelectionChange} className="px-2 py-1 my-5 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none">
                {summaryPipelines.map((pipeline) => (
                  <option key={pipeline} value={pipeline}>{pipeline}</option>
                ))}
              </select>
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-3">Step 1: Provide Context</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Enter Context as Text
                  </label>
                  <textarea
                    value={summaryContextText}
                    onChange={handleContextTextChange}
                    placeholder="Enter context here..."
                    className="w-full h-32 px-3 py-2 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                  />
                </div>
                <div className="flex items-center my-3">
                  <div className="flex-grow border-t border-slate-300"></div>
                  <span className="flex-shrink mx-4 text-slate-500 text-sm">OR</span>
                  <div className="flex-grow border-t border-slate-300"></div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Upload Context as PDF
                  </label>
                  <input
                    id="summary-context-file-input"
                    type="file"
                    onChange={handleContextFileChange}
                    accept="application/pdf"
                    className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:border-0 file:text-sm file:font-semibold
                    file:bg-slate-100 file:text-slate-700
                    hover:file:bg-slate-200
                    cursor-pointer rounded-lg border border-slate-200"
                  />
                  {summaryContextFile && <p className="text-xs text-slate-500 mt-2">Selected Context: {summaryContextFile.name}</p>}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-base font-semibold text-slate-800 mb-3">Step 2: Upload Comments</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select a CSV file with comments
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setSummaryCommentsFile(e.target.files[0])}
                    accept=".csv"
                    className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:border-0 file:text-sm file:font-semibold
                    file:bg-slate-100 file:text-slate-700
                    hover:file:bg-slate-200
                    cursor-pointer rounded-lg border border-slate-200"
                  />
                  {summaryCommentsFile && <p className="text-xs text-slate-500 mt-2">Selected Comments: {summaryCommentsFile.name}</p>}
                </div>

                <div className="flex items-center my-3">
                  <div className="flex-grow border-t border-slate-300"></div>
                  <span className="flex-shrink mx-4 text-slate-500 text-sm">OR upload audio/video</span>
                  <div className="flex-grow border-t border-slate-300"></div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Audio / Video File <span className="text-slate-400 font-normal">(optional — transcript added as a comment)</span>
                  </label>
                  <input
                    type="file"
                    accept="video/*,audio/*"
                    onChange={(e) => setSummaryMediaFile(e.target.files[0] || null)}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer rounded-lg border border-slate-200"
                  />
                  {summaryMediaFile && <p className="text-xs text-slate-500 mt-2">Selected: {summaryMediaFile.name}</p>}
                </div>
              </div>


              <button
                onClick={handleSummarize}
                disabled={
                  summaryLoading ||
                  (!summaryCommentsFile && !summaryMediaFile) ||
                  (!summaryContextText.trim() && !summaryContextFile)
                }
                className="w-full bg-slate-900 text-white py-2.5 px-4 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {summaryLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Summarize
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {summaryResult && (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-900 uppercase tracking-wide">
                      Summary Complete
                    </span>
                  </div>
                  <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words bg-white p-2">
                    <code>{JSON.stringify(summaryResult, null, 2)}</code>
                  </pre>
                </div>
              )}
              {summaryError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-medium uppercase tracking-wide text-red-900">
                      Summarization Error
                    </span>
                  </div>
                  <p className="text-sm text-red-700">{summaryError}</p>
                </div>
              )}

              {/* Video Generation Section */}
              {summaryResult && (
                <div className="mt-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-slate-800">🎬 Παραγωγή Βίντεο</span>
                  </div>

                  {/* Offer button if no job started yet */}
                  {!videoStatus && !videoLoading && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-600">Θέλετε να δημιουργηθεί βίντεο από την περίληψη;</p>
                      <button
                        onClick={handleGenerateVideo}
                        className="ml-4 bg-slate-900 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors shrink-0"
                      >
                        Δημιουργία Βίντεο
                      </button>
                    </div>
                  )}

                  {/* Pending / Processing */}
                  {(videoStatus === 'pending' || videoStatus === 'processing') && (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>
                        {videoStatus === 'pending' ? 'Η εργασία βίντεο υποβλήθηκε, αναμονή εκκίνησης...' : 'Το βίντεο παράγεται, παρακαλώ περιμένετε...'}
                      </span>
                    </div>
                  )}

                  {/* Error */}
                  {videoStatus === 'error' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-red-700">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{videoError || 'Αποτυχία παραγωγής βίντεο.'}</span>
                      </div>
                      <button
                        onClick={handleGenerateVideo}
                        className="text-sm text-slate-600 underline hover:text-slate-900"
                      >
                        Δοκιμή ξανά
                      </button>
                    </div>
                  )}

                  {/* Done */}
                  {videoStatus === 'done' && videoJobId && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-2">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>Το βίντεο είναι έτοιμο!</span>
                      </div>
                      <video
                        key={videoJobId}
                        controls
                        className="w-full rounded-lg border border-slate-200 max-h-72"
                        src={`${VIDEO_API_BASE_URL}/download/${videoJobId}`}
                      />
                      <div className="flex gap-3">
                        <a
                          href={`${VIDEO_API_BASE_URL}/download/${videoJobId}`}
                          download={`summary_video_${videoJobId.slice(0, 8)}.mp4`}
                          className="flex-1 text-center bg-slate-900 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
                        >
                          ⬇ Λήψη βίντεο
                        </a>
                        <button
                          onClick={handleDeleteVideo}
                          className="flex-1 bg-red-50 text-red-700 border border-red-200 py-2 px-4 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                        >
                          🗑 Διαγραφή
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <hr className="border-t-2 border-slate-400" />
          {/* Information Extraction Section */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileSearch2 className="w-5 h-5 text-slate-700" />
                <h1 className="text-lg font-semibold text-slate-900">Information Extraction Service</h1>
              </div>
            </div>

            <div className="p-6">
              <p>
                For the Information/ Argument Extraction, you must include a CSV file with comments. The CSV file <strong>must</strong> be structured as in the following <a href='https://docs.google.com/spreadsheets/d/1Oj-mgvvQ6oulAXa3CteeU5IYKSjCREcYJsLKchElpFk/edit?usp=sharing' className='text-cyan-800 font-bold'>csv example.</a><br />
                The tool will extract positions and arguments.<br />
                The positions are the ideas or answers to a specific issue raised by the user.<br />
                The arguments are the reasons that support or oppose those positions.
              </p>
              <select id="extraction-select" value={selectedExtrPipeline} onChange={handleExtractionSelectChange} className="px-2 py-1 my-5 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none">
                {extractionLLMS.map((llm) => (
                  <option key={llm} value={llm}>{llm}</option>
                ))}
              </select>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Upload a CSV file
                </label>
                <input
                  type="file"
                  onChange={(e) => setInformationExtractionFile(e.target.files[0])}
                  accept=".csv"
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:border-0 file:text-sm file:font-semibold
                    file:bg-slate-100 file:text-slate-700
                    hover:file:bg-slate-200
                    cursor-pointer rounded-lg border border-slate-200"
                />
                {informationExtractionFile && <p className="text-xs text-slate-500 mt-2">Selected File: {informationExtractionFile.name}</p>}
              </div>

              <div className="mt-4">
                <div className="flex items-center my-3">
                  <div className="flex-grow border-t border-slate-300"></div>
                  <span className="flex-shrink mx-4 text-slate-500 text-sm">OR upload audio/video</span>
                  <div className="flex-grow border-t border-slate-300"></div>
                </div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Audio / Video File <span className="text-slate-400 font-normal">(optional — transcript added as a comment)</span>
                </label>
                <input
                  type="file"
                  accept="video/*,audio/*"
                  onChange={(e) => setInformationExtractionMediaFile(e.target.files[0] || null)}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer rounded-lg border border-slate-200"
                />
                {informationExtractionMediaFile && <p className="text-xs text-slate-500 mt-2">Selected: {informationExtractionMediaFile.name}</p>}
              </div>

              <button
                onClick={handleInformationExtraction}
                disabled={(!informationExtractionFile && !informationExtractionMediaFile) || informationExtractionLoading}
                className="mt-6 w-full bg-slate-900 text-white py-2.5 px-4 rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {informationExtractionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Information Extraction
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {informationExtractionResult && (
                <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-900 uppercase tracking-wide">
                      Αποτελέσματα Εξαγωγής ({Object.keys(informationExtractionResult).length})
                    </span>
                  </div>

                  <div className="grid gap-4">
                    {Object.entries(informationExtractionResult).map(([title, argumentsList], index) => (
                      <div key={index} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">

                        {/* ΤΙΤΛΟΣ */}
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                          <h3 className="font-semibold text-slate-800 text-sm md:text-base">
                            {title}
                          </h3>
                        </div>

                        {/* Λίστα Επιχειρημάτων */}
                        <div className="p-3 space-y-2">
                          {argumentsList.map((arg, argIndex) => (
                            <div
                              key={argIndex}
                              className={`flex items-start gap-3 p-3 rounded-md text-sm border ${arg.is_type === 'positive'
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                                : arg.is_type === 'negative'
                                  ? 'bg-rose-50 border-rose-100 text-rose-800'
                                  : 'bg-slate-50 border-slate-100 text-slate-600'
                                }`}
                            >
                              <div className="mt-0.5 shrink-0">
                                {arg.is_type === 'positive' ? <ThumbsUp className="w-4 h-4" /> :
                                  arg.is_type === 'negative' ? <ThumbsDown className="w-4 h-4" /> :
                                    <AlertCircle className="w-4 h-4" />}
                              </div>

                              <span>{arg.label}</span>

                              <button onClick={handleFactCheck(arg.label)} className="ml-auto bg-slate-200 text-slate-700 py-1 px-3 rounded-md text-sm font-medium hover:bg-slate-300 transition-colors">
                                Fact-check
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {factCheckModal && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                  onClick={() => setFactCheckModal(false)}  // κλείσιμο με click εκτός
                >
                  <div
                    className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4"
                    onClick={(e) => e.stopPropagation()}    // αποφυγή κλεισίματος με click εντός
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold text-slate-800">Fact-Check Αποτέλεσμα</h2>
                      <button
                        onClick={() => setFactCheckModal(false)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Loading */}
                    {factCheckLoading && (
                      <div className="flex flex-col items-center justify-center py-8 gap-3 text-slate-500">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                        <span className="text-sm">Αναζήτηση & ανάλυση...</span>
                      </div>
                    )}

                    {/* Error */}
                    {factCheckError && (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-rose-50 border border-rose-100 text-rose-700 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{factCheckError}</span>
                      </div>
                    )}

                    {/* Αποτέλεσμα */}
                    {factCheckResult && !factCheckLoading && (
                      <div className="space-y-4">

                        {/* Verdict badge */}
                        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm
            ${factCheckResult.verdict === "TRUE"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : factCheckResult.verdict === "FALSE"
                              ? "bg-rose-50 border border-rose-200 text-rose-700"
                              : "bg-amber-50 border border-amber-200 text-amber-700"
                          }`}
                        >
                          <span className="text-lg">{factCheckResult.icon}</span>
                          <span>{factCheckResult.verdict}</span>
                          <span className="ml-auto text-xs font-normal opacity-70">
                            Confidence: {(factCheckResult.confidence * 100).toFixed(0)}%
                          </span>
                        </div>

                        {/* Εξήγηση */}
                        {factCheckResult.explanation && (
                          <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-md p-3 border border-slate-100">
                            {factCheckResult.explanation}
                          </div>
                        )}

                        {/* Πηγές */}
                        {factCheckResult.sources?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Πηγές</p>
                            <ul className="space-y-1">
                              {factCheckResult.sources.map((src, i) => (
                                <li key={i}>
                                  <a
                                    href={src.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline line-clamp-1"
                                  >
                                    {src.title}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;