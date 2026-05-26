import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import UserPage from './pages/UserPage'
import AdminPage from './pages/AdminPage'

function App() {
  const [llms, setllms] = useState([])
  const [commentArray, setCommentArray] = useState([])
  const [summaryPipelines, setSummaryPipelines] = useState([])
  const [data, setData] = useState(null)

  const token = 'sk_e7a6446e489e8fc47492c03afd3025cd08b9985202dd51f8870656c1e6a2ae34a78fa3a762d605d230'

  useEffect(() => {
    async function fetchllms() {
      const url = new URL(`http://localhost:8000/get_llms`);
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'ai4d': 'ssWTusBwSZujqq8T3gswAcQ6KuTyXNuTQNWvdr_Z0Z4sx6xrpbfyz8HoRw' }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setllms(data.llms);
    }

    async function fetchData() {
      const url = `/api/projekt_phases/1798/comments`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.log(data.data.comments);
      if (data?.data?.comments) {
        const temp = data.data.comments.map((comment: any) => comment.body);
        setCommentArray(temp);
      } else {
        console.warn("Τα δεδομένα δεν έχουν την αναμενόμενη δομή:", data);
      }
      setData(data);
    }

    const fetchSummaryPipeline = async () => {
      try {
        const url = new URL(`http://localhost:8000/get_summary_pipelines`);
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'ai4d': 'ssWTusBwSZujqq8T3gswAcQ6KuTyXNuTQNWvdr_Z0Z4sx6xrpbfyz8HoRw' }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log("Summary Pipelines:", data.summary_pipelines);
        setSummaryPipelines(data.summary_pipelines)
      } catch (error) { 
        console.error("Summary Pipeline Failed", error); 
      }
    }

    fetchllms()
    fetchData()
    fetchSummaryPipeline()
  }, [])

  return (
    <BrowserRouter>
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <Routes>
          <Route path="/user" element={<UserPage llms={llms} commentArray={commentArray} summaryPipelines={summaryPipelines} />} />
          <Route path="/admin" element={<AdminPage llms={llms} commentArray={commentArray} />} />
          <Route path="/" element={<Navigate to="/user" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
