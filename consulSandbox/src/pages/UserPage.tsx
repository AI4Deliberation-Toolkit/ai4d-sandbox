import { useState } from 'react';
import PositionList from '../components/PositionList';
import { CheckCircle, FileText, LayoutList, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_KEY = import.meta.env.VITE_API_KEY || '';
const API_HEADER = { 'ai4d': API_KEY };
const BACKEND = import.meta.env.VITE_BACKEND_URL || window.location.origin.replace(':3001', ':8000');
const DELIBERATION_ID = 1798;

export default function UserPage() {
  const [summaryResult, setSummaryResult] = useState('');
  const [extractResult, setExtractResult] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  const fetchDatabaseData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND}/db/deliberation/${DELIBERATION_ID}`, {
        method: 'GET',
        headers: API_HEADER,
      });
      if (!response.ok) throw new Error('No data found for this deliberation.');
      return await response.json();
    } catch (error) {
      console.error("Fetch error:", error);
      alert("Failed to fetch from database.");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowSummary = async () => {
    setActiveSection('summary');
    const data = await fetchDatabaseData();
    if (data && data.summary) {
      setSummaryResult(data.summary);
    } else {
      alert("No summary saved in the database.");
    }
  };

  const handleShowPositions = async () => {
    setActiveSection('positions');
    const data = await fetchDatabaseData();
    if (data && data.comments && data.comments.length > 0) {
      const positions = data.comments[0].positions?.positions || [];
      if (positions.length > 0) {
        setExtractResult(positions);
      } else {
        alert("No positions saved in the database.");
      }
    } else {
      alert("No comments or positions found.");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .up-root {
          font-family: 'Sora', sans-serif;
          min-height: 100vh;
          background: #f5f4f0;
          background-image:
            radial-gradient(circle at 15% 20%, rgba(59,130,246,0.06) 0%, transparent 50%),
            radial-gradient(circle at 85% 75%, rgba(16,185,129,0.05) 0%, transparent 50%);
          padding: 3rem 1.5rem;
        }

        .up-container {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .up-header {
          margin-bottom: 0.5rem;
        }

        .up-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          font-weight: 500;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 0.4rem;
        }

        .up-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #1e293b;
          letter-spacing: -0.02em;
        }

        .up-card {
          background: #ffffff;
          border: 1px solid #e8e6e0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03);
          transition: box-shadow 0.25s ease;
        }

        .up-card:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05);
        }

        .up-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.4rem 1.6rem;
          border-bottom: 1px solid #f1f0eb;
        }

        .up-card-title-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .up-icon-wrap {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .up-icon-wrap.blue {
          background: #eff6ff;
          color: #3b82f6;
        }

        .up-icon-wrap.emerald {
          background: #f0fdf4;
          color: #10b981;
        }

        .up-card-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: #1e293b;
          letter-spacing: -0.01em;
        }

        .up-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1.1rem;
          font-family: 'Sora', sans-serif;
          font-size: 0.8rem;
          font-weight: 500;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.18s ease;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }

        .up-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .up-btn.blue {
          background: #3b82f6;
          color: #fff;
        }

        .up-btn.blue:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59,130,246,0.3);
        }

        .up-btn.emerald {
          background: #10b981;
          color: #fff;
        }

        .up-btn.emerald:hover:not(:disabled) {
          background: #059669;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16,185,129,0.3);
        }

        .up-btn.blue:active:not(:disabled),
        .up-btn.emerald:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: none;
        }

        .up-card-body {
          padding: 1.4rem 1.6rem;
          animation: fadeSlideIn 0.3s ease;
        }

        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .up-summary-content {
          background: #f8f7f3;
          border: 1px solid #ede9e0;
          border-radius: 10px;
          padding: 1.2rem 1.4rem;
          color: #374151;
          font-size: 0.9rem;
          line-height: 1.75;
        }

        .up-summary-content p { margin: 0 0 0.75rem 0; }
        .up-summary-content p:last-child { margin-bottom: 0; }
        .up-summary-content strong { color: #1e293b; font-weight: 600; }
        .up-summary-content h1,
        .up-summary-content h2,
        .up-summary-content h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
          margin: 1rem 0 0.4rem;
          letter-spacing: -0.01em;
        }
        .up-summary-content ul, .up-summary-content ol {
          padding-left: 1.2rem;
          margin: 0.5rem 0;
        }

        .up-positions-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-bottom: 0.9rem;
          margin-bottom: 0.9rem;
          border-bottom: 1px solid #f1f0eb;
        }

        .up-badge {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.7rem;
          font-weight: 500;
          background: #f0fdf4;
          color: #059669;
          border: 1px solid #a7f3d0;
          border-radius: 20px;
          padding: 0.15rem 0.6rem;
          letter-spacing: 0.04em;
        }

        .up-positions-label {
          font-size: 0.82rem;
          font-weight: 500;
          color: #64748b;
        }

        .up-empty {
          padding: 2rem 1.6rem;
          text-align: center;
          color: #94a3b8;
          font-size: 0.82rem;
          font-family: 'IBM Plex Mono', monospace;
          letter-spacing: 0.03em;
        }

        .up-divider {
          height: 1px;
          background: #f1f0eb;
          margin: 0 1.6rem;
        }
      `}</style>

      <div className="up-root">
        <div className="up-container">

          <div className="up-header">
            <div className="up-label">Deliberation #{DELIBERATION_ID}</div>
            <div className="up-title">Analysis Dashboard</div>
          </div>

          {/* Summary Card */}
          <div className="up-card">
            <div className="up-card-header">
              <div className="up-card-title-group">
                <div className="up-icon-wrap blue">
                  <FileText size={16} />
                </div>
                <span className="up-card-title">Summary</span>
              </div>
              <button
                className="up-btn blue"
                onClick={handleShowSummary}
                disabled={isLoading && activeSection === 'summary'}
              >
                {isLoading && activeSection === 'summary' ? (
                  <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading…</>
                ) : 'Fetch from Database'}
              </button>
            </div>

            {summaryResult ? (
              <div className="up-card-body">
                <div className="up-summary-content">
                  <ReactMarkdown>{summaryResult}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="up-empty">No summary loaded yet</div>
            )}
          </div>

          {/* Positions Card */}
          <div className="up-card">
            <div className="up-card-header">
              <div className="up-card-title-group">
                <div className="up-icon-wrap emerald">
                  <LayoutList size={16} />
                </div>
                <span className="up-card-title">Positions &amp; Arguments</span>
              </div>
              <button
                className="up-btn emerald"
                onClick={handleShowPositions}
                disabled={isLoading && activeSection === 'positions'}
              >
                {isLoading && activeSection === 'positions' ? (
                  <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading…</>
                ) : 'Fetch from Database'}
              </button>
            </div>

            {extractResult.length > 0 ? (
              <div className="up-card-body">
                <div className="up-positions-header">
                  <CheckCircle size={14} color="#10b981" />
                  <span className="up-positions-label">Positions found</span>
                  <span className="up-badge">{extractResult.length}</span>
                </div>
                <PositionList positions={extractResult} />
              </div>
            ) : (
              <div className="up-empty">No positions loaded yet</div>
            )}
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}