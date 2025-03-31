import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileUp, Loader2, Box as Box3d, Calendar, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AsyncSelect from 'react-select/async';
import './App.css';

function Landing() {
  const [selectedCase, setSelectedCase] = useState('');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const fileInputRef = useRef(null);
  const [description, setDescription] = useState('');
  const [caseDate, setCaseDate] = useState('');
  const [location, setLocation] = useState('');
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
        body: JSON.stringify({ 
          case_description: description,
          case_date: caseDate,
          location: location
        }),
      });
      const data = await response.json();
      setSelectedCase(data.case_id);
      fetchCases();
      setDescription('');
      setCaseDate('');
      setLocation('');
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

  const loadLocationOptions = async (inputValue) => {
    if (!inputValue) return [];
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${inputValue}`);
      const data = await response.json();
      return data.map((place) => ({
        label: place.display_name,
        value: place.display_name
      }));
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      return [];
    }
  };

  return (
    <div className="app-container">
      <div className="content-wrapper">
        <h1 className="main-title">Forensic360🔎</h1>
        
        <div className="card">
          <h2 className="section-title">Create New Case</h2>
          <div className="input-group">
            <div className="input-container">
              <label className="input-label">Description</label>
              <input
                type="text"
                className="text-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter case description"
              />
            </div>
          </div>
          
          <div className="input-row">
            <div className="input-container">
              <label className="input-label">Date</label>
              <Calendar className="input-icon" size={16} />
              <input
                type="date"
                className="text-input input-with-icon"
                value={caseDate}
                onChange={(e) => setCaseDate(e.target.value)}
              />
            </div>
            
            <div className="input-container">
              <label className="input-label">Location</label>
              <MapPin className="input-icon" size={16} />
              <AsyncSelect
                cacheOptions
                defaultOptions
                loadOptions={loadLocationOptions}
                onChange={(selectedOption) => setLocation(selectedOption.value)}
                placeholder="Search for a location"
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
          </div>
          
          <button 
            className="button primary"
            onClick={createCase} 
            disabled={loading || !description || !caseDate || !location}
          >
            {loading ? <Loader2 className="spinner" /> : 'Create Case'}
          </button>
        </div>

        <div className="card">
          <h2 className="section-title">Upload Analysis</h2>
          <select 
            className="select-input"
            value={selectedCase} 
            onChange={(e) => setSelectedCase(e.target.value)}
          >
            <option value="">Select a case</option>
            {cases.map((c) => (
              <option key={c.case_id} value={c.case_id}>
                Case {c.case_id}: {c.case_description} - {new Date(c.case_date).toLocaleDateString()} - {c.location}
              </option>
            ))}
          </select>
          
          <div 
            className="upload-area"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="upload-icon" />
            <p>Click to upload crime scene image</p>
            <input 
              ref={fileInputRef} 
              type="file" 
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden" 
            />
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
              <span className="result-label">Position and Orientation:</span>
              <span className="result-value">{analysis['Position and Orientation']}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Wound Info:</span>
              <span className="result-value">{analysis['Wound Info']}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Wound Occured:</span>
              <span className="result-value">{analysis['Wound Occurred']}</span>
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
