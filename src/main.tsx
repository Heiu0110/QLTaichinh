import { LocalDataProvider } from './db/context/LocalDataProvider';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { AuthProvider } from './auth/AuthProvider';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LocalDataProvider>
          <App />
        </LocalDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
