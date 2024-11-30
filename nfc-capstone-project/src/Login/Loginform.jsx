import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { Mail, Lock, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import styles from '../Login/Login.module.css'

const Loginform = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const auth = getAuth();

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/dashboard'); // Navigate to main app after successful auth
    } catch (error) {
      setError(
        error.code === 'auth/user-not-found' ? 'User not found. Please sign up.' :
        error.code === 'auth/wrong-password' ? 'Invalid password.' :
        error.code === 'auth/email-already-in-use' ? 'Email already registered. Please sign in.' :
        'Authentication failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/dashboard'); // Navigate to main app after successful auth
    } catch (error) {
      setError('Google authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.login_container}>
      <div className={styles.login_box}>
        <div className={styles.login_header}>
          <h2>{isSignUp ? 'Create your account' : 'Sign in to your account'}</h2>
        </div>

        {error && (
          <div className={styles.error_message}>
            <AlertCircle className={styles.error_icon}/>
            <p>{error}</p>
          </div>
        )}

        <form className={styles.login_form} onSubmit={handleEmailAuth}>
          <div className={styles.login_form_group}>
            <div className={styles.input_wrapper}>
              <Mail className={styles.input_icon}/>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.login_form_group}>
            <div className={styles.input_wrapper}>
              <Lock className={styles.input_icon} />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.submit_button}
          >
            {isSignUp ? <UserPlus className={styles.button_icon} /> : <LogIn className={styles.button_icon} />}
            {loading ? 'Processing' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className={styles.google_button}
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google" 
              className={styles.google_icon}
            />
            Continue with Google
          </button>
        </form>

        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError('');
          }}
          className={styles.toggle_auth_button}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
};

export default Loginform;