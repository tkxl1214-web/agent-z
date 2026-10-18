import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import { googleOAuthClientId } from './google';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleOAuthClientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
