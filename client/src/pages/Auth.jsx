import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useUi } from '../context/UiContext.jsx';

export default function Auth({ mode }) {
  const isReg = mode === 'register';
  const { signIn } = useAuth();
  const { toast } = useUi();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      const user = await signIn(isReg ? '/auth/register' : '/auth/login', body);
      toast(isReg ? 'Account created. 50 points added.' : `Welcome back, ${user.name.split(' ')[0]}.`);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="auth" key={mode}>
      <p className="hand">{isReg ? 'Tap in' : 'Welcome back'}</p>
      <h1 className="display">{isReg ? 'Create your account' : 'Sign in'}</h1>
      <p className="hint">{isReg ? 'New accounts start with 50 points.' : 'Sign in to keep your streak going.'}</p>
      <form onSubmit={onSubmit} noValidate>
        {isReg && (
          <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" required autoFocus /></div>
        )}
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required autoFocus={!isReg} /></div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete={isReg ? 'new-password' : 'current-password'} minLength={8} required />
          {isReg && <span className="hint">At least 8 characters.</span>}
        </div>
        <p className="form-error" role="alert">{error}</p>
        <button className="btn" type="submit" style={{ width: '100%' }} disabled={busy}>{isReg ? 'Create account' : 'Sign in'}</button>
      </form>
      <p style={{ marginTop: '1.25rem', textAlign: 'center' }}>
        {isReg ? <>Already have an account? <Link to="/login" state={location.state}>Sign in</Link></> : <>New here? <Link to="/register" state={location.state}>Create an account</Link></>}
      </p>
      {!isReg && <p className="hint" style={{ textAlign: 'center' }}>Demo admin: admin@punchng.test / Admin@12345</p>}
    </section>
  );
}
