import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../../css/admin/adminlte.min.css';
import 'bootstrap-icons/font/bootstrap-icons.min.css';
import '../../css/admin/admin.css';
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
