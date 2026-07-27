'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Bot, Send, Sparkles, Zap, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { useChat } from '@/lib/hooks/useChat';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const QUICK_ACTIONS = [
  { id: 'qa-1', label: 'Run scrape now', icon: <Zap size={13} /> },
  { id: 'qa-2', label: 'Check price alerts', icon: <TrendingUp size={13} /> },
  { id: 'qa-3', label: 'Review pending queue', icon: <Package size={13} /> },
  { id: 'qa-4', label: 'Best cashback today', icon: <Sparkles size={13} /> },
];

const SYSTEM_PROMPT = `You are DropAutoAI, an intelligent assistant for a dropshipping automation dashboard. You help the user manage their dropshipping business which sources products from AliExpress and sells them on Bonanza marketplace (which syncs to Google Shopping).

Your capabilities include: AliExpress product sourcing, Bonanza listings management, Google Shopping feed optimization, pricing rules and profit margin calculations, product review queue management, activity logs and error diagnosis, scrape campaigns, and order management.

Be concise, direct, and actionable. Help diagnose errors and give specific advice.`;

interface AIAgentPanelProps {
  onClose: () => void;
}

export default function AIAgentPanel({ onClose }: AIAgentPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-init',
      role: 'assistant',
      content: "Hi! I'm your DropAutoAI agent. I can help you run scrapes, review product margins, manage listings, route orders through cashback sites, and monitor your pipeline health. What would you like to do?",
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' }),
    },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingMsgIdRef = useRef<string | null>(null);

  const { response, isLoading, error, sendMessage: sendToAI } = useChat('OPEN_AI', 'gpt-4o', true);

  useEffect(() => {
    if (error) {
      toast.error(error.message || 'AI Agent error. Check your OpenAI API key.');
    }
  }, [error]);

  useEffect(() => {
    if (!response) return;
    if (isLoading) {
      if (!pendingMsgIdRef.current) {
        const newId = `msg-ai-${Date.now()}`;
        pendingMsgIdRef.current = newId;
        setMessages(prev => [
          ...prev,
          {
            id: newId,
            role: 'assistant',
            content: response,
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' }),
          },
        ]);
      } else {
        setMessages(prev =>
          prev.map(m => m.id === pendingMsgIdRef.current ? { ...m, content: response } : m)
        );
      }
    } else {
      if (pendingMsgIdRef.current) {
        setMessages(prev =>
          prev.map(m => m.id === pendingMsgIdRef.current ? { ...m, content: response } : m)
        );
        pendingMsgIdRef.current = null;
      }
    }
  }, [response, isLoading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' }),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    pendingMsgIdRef.current = null;

    const apiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...updatedMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];
    sendToAI(apiMessages, { max_completion_tokens: 512 });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border-l border-border flex flex-col animate-slide-in-right h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">DropAutoAI</p>
              <div className="flex items-center gap-1">
                <div className="pulse-dot bg-positive w-1.5 h-1.5" />
                <p className="text-xs text-muted-foreground">Online · GPT-4o · Live AI</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={16} />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-2 border-b border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Quick Actions</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.id}
                onClick={() => sendMessage(qa.label)}
                disabled={isLoading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-foreground border border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-150 disabled:opacity-50"
              >
                <span className="text-primary">{qa.icon}</span>
                {qa.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={13} className="text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user' ?'bg-primary/10 text-foreground border border-primary/20' :'bg-secondary text-foreground border border-border'
                }`}
              >
                <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{msg.timestamp}</p>
              </div>
            </div>
          ))}

          {isLoading && !pendingMsgIdRef.current && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot size={13} className="text-primary" />
              </div>
              <div className="bg-secondary border border-border px-3 py-2 rounded-xl">
                <div className="flex gap-1 items-center h-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={`dot-${i}`}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-xs" style={{ color: '#ef4444' }}>AI error. Check your OpenAI API key.</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="Ask anything about your pipeline..."
              className="input-base flex-1 text-sm"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="btn-primary px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Powered by OpenAI GPT-4o · Verify critical actions
          </p>
        </div>
      </div>
    </div>
  );
}