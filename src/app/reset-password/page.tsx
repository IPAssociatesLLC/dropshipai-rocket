'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
      <div className="w-full max-w-md px-6 py-10">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Reset Password</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {sent ? 'Check your inbox' : "We'll send you a reset link"}
          </p>
        </div>

        <div className="rounded-2xl border p-8" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}>
                <svg className="w-7 h-7" style={{ color: '#6366f1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                A password reset link has been sent to <strong style={{ color: 'var(--foreground)' }}>{email}</strong>. Check your inbox and follow the link to reset your password.
              </p>
              <Link
                href="/login"
                className="inline-block mt-2 text-sm font-medium hover:underline"
                style={{ color: 'var(--primary)' }}
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}

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

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff' }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>

              <p className="text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--primary)' }}>
                  ← Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
