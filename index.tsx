import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { HotelProvider } from './contexts/HotelContext';
import { AuthProvider } from './contexts/AuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* TÜM UYGULAMAYI PROVIDER İLE SARMALIYORUZ */}
    <AuthProvider>
      <HotelProvider>
        <App />
      </HotelProvider>
    </AuthProvider>
  </React.StrictMode>,
);