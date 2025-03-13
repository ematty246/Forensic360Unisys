import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileUp, Loader2, Box as Box3d } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import './App.css';

function Landing() {
  const [selectedCase, setSelectedCase] = useState('');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const fileInputRef = useRef(null);
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const response = await fetch('http://localhost:8000/cases/');
      const data = await response.json();
      setCases(data);
    } catch (error) {
      console.error('Error fetching cases:', error);
    }
  };

  const createCase = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/cases/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_description: description }),
      });
      const data = await response.json();
      setSelectedCase(data.case_id);
      fetchCases();
      setDescription('');
    } catch (error) {
      console.error('Error creating case:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedCase) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/analyze/${selectedCase}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      console.error('Error analyzing image:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="content-wrapper">
        <h1 className="main-title">Forensic360🔎</h1>
        <div className="card">
          <h2 className="section-title">Create New Case</h2>
          <div className="input-group">
            <input
              type="text"
              className="text-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter case description"
            />
            <button className="button primary" onClick={createCase} disabled={loading || !description}>
              {loading ? <Loader2 size={20} className="spinner" /> : 'Create Case'}
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Upload Analysis</h2>
          <select className="select-input" value={selectedCase} onChange={(e) => setSelectedCase(e.target.value)}>
            <option value="">Select a case</option>
            {cases.map((c) => (
              <option key={c.case_id} value={c.case_id}>
                Case {c.case_id}: {c.case_description}
              </option>
            ))}
          </select>
          <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
            <Upload size={48} className="upload-icon" />
            <p>Click to upload crime scene image</p>
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} accept="image/*" className="hidden" />
          </div>
        </div>

        {analysis && (
          <div className="card analysis-results">
            <h2 className="section-title">Analysis Results</h2>
            <div className="result-item">
              <span className="result-label">Blood Stain Intensity:</span>
              <span className="result-value">{analysis['Blood Stain Intensity']}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Estimated Blood Loss:</span>
              <span className="result-value">{analysis['Estimated Blood Loss (L)']}L</span>
            </div>
            <div className="result-item">
              <span className="result-label">Wound Width:</span>
              <span className="result-value">{analysis['Estimated Wound Width (mm)']}mm</span>
            </div>
            <div className="result-item">
              <span className="result-label">Wound Depth:</span>
              <span className="result-value">{analysis['Estimated Wound Depth (mm)']}mm</span>
            </div>
            <button className="button secondary" onClick={() => navigate('/view')}>
              <Box3d size={20} /> View in 3D
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Landing;
