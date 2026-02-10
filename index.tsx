
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HotelProvider } from './contexts/HotelContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HotelProvider>
      <App />
    </HotelProvider>
  </React.StrictMode>
);
