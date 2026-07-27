'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
      <div className="w-full max-w-md px-6 py-10">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <img src="/assets/images/dropautoai_logo.png" alt="DropAutoAI Logo" width={64} height={64} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>DropAutoAI</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border p-8" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--input)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Password
                </label>
                <Link href="/reset-password" className="text-xs hover:underline" style={{ color: 'var(--primary)' }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors pr-10"
                  style={{
                    backgroundColor: 'var(--input)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium hover:underline" style={{ color: 'var(--primary)' }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
