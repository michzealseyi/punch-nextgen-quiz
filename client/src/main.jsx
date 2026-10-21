import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { UiProvider } from './context/UiContext.jsx';
import Admin from './pages/Admin.jsx';
import Auth from './pages/Auth.jsx';
import Challenge from './pages/Challenge.jsx';
import Contribute from './pages/Contribute.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Explore from './pages/Explore.jsx';
import Home from './pages/Home.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Play from './pages/Play.jsx';
import Rewards from './pages/Rewards.jsx';
import './styles.css';

// A new quiz id means a fresh player, not a reused one
function PlayRoute() {
  const { id } = useParams();
  return <RequireAuth><Play key={id} /></RequireAuth>;
}

const NotFound = () => <div className="empty"><p>That page doesn’t exist.</p><Link className="btn" to="/">Back to quizzes</Link></div>;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <UiProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="challenge" element={<Challenge />} />
              <Route path="explore" element={<Explore />} />
              <Route path="leaderboard" element={<Leaderboard key="all" period="all" />} />
              <Route path="leaderboard/week" element={<Leaderboard key="week" period="week" />} />
              <Route path="rewards" element={<Rewards />} />
              <Route path="login" element={<Auth mode="login" />} />
              <Route path="register" element={<Auth mode="register" />} />
              <Route path="quiz/:id" element={<PlayRoute />} />
              <Route path="me" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="contribute" element={<RequireAuth><Contribute /></RequireAuth>} />
              <Route path="admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </UiProvider>
    </BrowserRouter>
  </StrictMode>,
);
