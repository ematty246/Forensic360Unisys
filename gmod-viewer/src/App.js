import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Landing from './Landing';
import View from './View';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/view" element={<View />} />
    </Routes>
  );
}

export default App;


