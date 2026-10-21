import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Sends signed-out visitors to /login and back again afterwards. The server still checks every request.
export default function RequireAuth({ admin = false, children }) {
  const { me } = useAuth();
  const location = useLocation();
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && me.role !== 'admin') return <div className="empty"><p>This page is for admins.</p></div>;
  return children;
}
