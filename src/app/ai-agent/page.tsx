'use client';

import React, { useState, useRef, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { Bot, Send, Sparkles, Zap, Package, TrendingUp, AlertCircle } from 'lucide-react';
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

Your capabilities and knowledge include:
- AliExpress product sourcing and DS API integration
- Bonanza marketplace listings management
- Google Shopping feed optimization and approval requirements
- Pricing rules and profit margin calculations (Marketplace fee %, PayPal fee %, shipping costs, min/max profit margins)
- Product review queue management
- Activity logs and error diagnosis
- Scrape campaigns and automation
- Order management and fulfillment

When users ask about their pipeline, give specific, actionable advice. If they report errors, help diagnose and fix them. Be concise and direct. You have access to the context of their dropshipping business.`;

export default function AIAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-init',
      role: 'assistant',
      content:
        "Hi! I'm your DropAutoAI agent. I can help you run scrapes, review product margins, manage listings, route orders through cashback sites, diagnose errors, and monitor your pipeline health. What would you like to do?",
      timestamp: '',
    },
  ]);
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { response, isLoading, error, sendMessage: sendToAI } = useChat('OPEN_AI', 'gpt-4o', true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error.message || 'AI Agent error. Check your OpenAI API key in API Connections.');
    }
  }, [error]);

  // Append streaming response as assistant message when done
  const prevResponseRef = useRef('');
  const pendingMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;

    if (isLoading) {
      // Streaming in progress — update or create the pending message
      if (!pendingMsgIdRef.current) {
        const newId = `msg-ai-${Date.now()}`;
        pendingMsgIdRef.current = newId;
        setMessages(prev => [
          ...prev,
          {
            id: newId,
            role: 'assistant',
            content: response,
            timestamp: mounted ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' }) : '',
          },
        ]);
      } else {
        setMessages(prev =>
          prev.map(m => m.id === pendingMsgIdRef.current ? { ...m, content: response } : m)
        );
      }
    } else {
      // Done streaming
      if (pendingMsgIdRef.current) {
        setMessages(prev =>
          prev.map(m => m.id === pendingMsgIdRef.current ? { ...m, content: response } : m)
        );
        pendingMsgIdRef.current = null;
      }
      prevResponseRef.current = response;
    }
  }, [response, isLoading, mounted]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const getTime = () =>
    mounted
      ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' })
      : '';

  const sendMessage = (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: getTime(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    pendingMsgIdRef.current = null;

    // Build conversation history for OpenAI (exclude the initial greeting timestamp issue)
    const apiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...updatedMessages
        .filter(m => m.id !== 'msg-init' || m.role === 'user')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
    ];

    sendToAI(apiMessages, { max_completion_tokens: 1024 });
  };

  return (
    <AppLayout title="AI Agent" subtitle="Your intelligent DropAutoAI pipeline assistant">
      <div className="flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
        <div className="card-elevated flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">DropAutoAI</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-positive" />
                <p className="text-xs text-muted-foreground">Online · GPT-4o · Live AI</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-5 py-3 border-b border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.id}
                  onClick={() => sendMessage(qa.label)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-foreground border border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-150 disabled:opacity-50"
                >
                  <span className="text-primary">{qa.icon}</span>
                  {qa.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={14} className="text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' ?'bg-primary/10 text-foreground border border-primary/20 rounded-tr-sm' :'bg-secondary text-foreground border border-border rounded-tl-sm'
                  }`}
                >
                  <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  {msg.timestamp && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">{msg.timestamp}</p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && !pendingMsgIdRef.current && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-primary" />
                </div>
                <div className="bg-secondary border border-border px-4 py-3 rounded-2xl rounded-tl-sm">
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
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <p className="text-xs" style={{ color: '#ef4444' }}>
                  AI error: {error.message}. Make sure your OpenAI API key is set in the .env file.
                </p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-5 py-4 border-t border-border">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                placeholder="Ask anything about your pipeline..."
                className="input-base flex-1 text-sm"
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="btn-primary px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Powered by OpenAI GPT-4o · Responses are AI-generated, verify critical actions
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
