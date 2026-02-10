import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { HotelProvider } from './contexts/HotelContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* TÜM UYGULAMAYI PROVIDER İLE SARMALIYORUZ */}
    <HotelProvider>
      <App />
    </HotelProvider>
  </React.StrictMode>,
);