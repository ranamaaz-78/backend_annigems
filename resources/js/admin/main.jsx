import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../../css/admin/metronic.css';
import App from './App';
import { AuthProvider } from './auth';

createRoot(document.getElementById('admin-root')).render(
    <React.StrictMode>
        <BrowserRouter basename="/admin">
            <AuthProvider>
                <App />
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>,
);
