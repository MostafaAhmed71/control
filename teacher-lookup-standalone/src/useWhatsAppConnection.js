import { useState, useEffect, useCallback } from 'react';
import { getWhatsAppApiBase, resolveWhatsAppApiBase } from './dataService';

function normalizeWaStatus(data) {
  const status = data?.status || 'disconnected';
  const connected = data?.connected === true || status === 'connected';
  return {
    status,
    qr: data?.qr || '',
    pairingCode: data?.pairingCode || '',
    connected,
  };
}

export function useWhatsAppConnection(appConfig) {
  const [apiBase, setApiBase] = useState(() =>
    appConfig ? resolveWhatsAppApiBase(appConfig) : ''
  );
  const [status, setStatus] = useState({
    status: 'loading',
    qr: '',
    pairingCode: '',
    connected: false,
  });
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (appConfig) {
      setApiBase(resolveWhatsAppApiBase(appConfig));
      return;
    }
    getWhatsAppApiBase().then(setApiBase);
  }, [appConfig]);

  const checkStatus = useCallback(async () => {
    if (!apiBase) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${apiBase}/qr-json`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(normalizeWaStatus(data));
      setFetchError('');
    } catch (err) {
      clearTimeout(timeoutId);
      setFetchError(err?.message || 'تعذّر الاتصال بخادم واتساب');
      setStatus({ status: 'server_down', qr: '', pairingCode: '', connected: false });
    }
  }, [apiBase]);

  useEffect(() => {
    if (!apiBase) return;
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [apiBase, checkStatus]);

  return { apiBase, status, fetchError, checkStatus };
}
