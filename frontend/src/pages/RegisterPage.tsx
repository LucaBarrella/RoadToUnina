import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

/**
 * User account registration page view providing form controls for email, username, and password.
 *
 * @returns React view component for the /register route.
 */
export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !username.trim() || !password) {
      setError('Tutti i campi sono obbligatori.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await register({ email, username, password });
      navigate('/game');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la registrazione. Riprova.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neo-bg bg-dot-pattern flex items-center justify-center p-3 sm:p-4 text-neo-black">
      <Card variant="white" className="w-full max-w-md p-6 sm:p-8">
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt="RoadToUnina Logo"
            className="w-14 h-14 object-contain border-3 border-neo-black shadow-neo-sm mx-auto mb-3 bg-neo-cyan p-1"
          />
          <h1 className="font-space font-black text-2xl sm:text-3xl uppercase tracking-tight text-neo-black">
            Crea Account
          </h1>
          <p className="font-inter text-sm text-neo-black mt-1 font-medium">
            Unisciti alla community di Wikipedia Speedrunner di Unina
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 bg-neo-pink text-neo-on-accent p-3 border-3 border-neo-black shadow-neo-sm font-space font-bold text-sm flex items-center gap-2"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">
              warning
            </span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-inter">
          <div>
            <label htmlFor="register-email" className="block font-mono text-xs font-bold uppercase mb-1 text-neo-black">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@esempio.it"
              className="w-full p-3 border-3 border-neo-black font-inter text-neo-black bg-neo-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neo-black focus-visible:ring-offset-2 shadow-neo-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="register-username" className="block font-mono text-xs font-bold uppercase mb-1 text-neo-black">
              Username
            </label>
            <input
              id="register-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="es. NeoRunner_99"
              className="w-full p-3 border-3 border-neo-black font-inter text-neo-black bg-neo-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neo-black focus-visible:ring-offset-2 shadow-neo-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="register-password" className="block font-mono text-xs font-bold uppercase mb-1 text-neo-black">
              Password (minimo 6 caratteri)
            </label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 border-3 border-neo-black font-inter text-neo-black bg-neo-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neo-black focus-visible:ring-offset-2 shadow-neo-sm"
              minLength={6}
              required
            />
          </div>

          <Button
            type="submit"
            variant="secondary"
            loading={loading}
            className="w-full mt-4"
          >
            Registrati Ora
          </Button>
        </form>

        <div className="mt-6 border-t-2 border-dashed border-neo-black pt-4 text-center font-inter text-sm text-neo-black font-medium">
          Hai già un account?{' '}
          <Link
            to="/login"
            className="font-bold underline text-neo-black hover:bg-neo-yellow px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-black"
          >
            Accedi qui
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
