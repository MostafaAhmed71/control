import React from 'react'
import ReactDOM from 'react-dom/client'
import ParentRsvp from './ParentRsvp'
import AdminDashboard from './AdminDashboard'
import './index.css'

const path = (window.location.pathname || '/').replace(/\/+$/, '').toLowerCase();
const isAdmin = path === '/admin' || path.endsWith('/admin');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? <AdminDashboard /> : <ParentRsvp />}
  </React.StrictMode>,
)
