import { useEffect, useRef, useState } from 'react';
import { DocumentUpdateEvent, Job } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://856uc0mf7l.execute-api.eu-central-1.amazonaws.com/production';

export const useWebSocket = (isPaused: boolean) => {
  const [jobs, setJobs] = useState<Map<string, Job>>(new Map());
  const [events, setEvents] = useState<DocumentUpdateEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [sessionStartTime] = useState<number>(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const eventBufferRef = useRef<DocumentUpdateEvent[]>([]);
  const isPausedRef = useRef(isPaused);

  // Keep ref in sync with isPaused
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Process buffered events when unpausing
  useEffect(() => {
    if (!isPaused && eventBufferRef.current.length > 0) {
      console.log(`Processing ${eventBufferRef.current.length} buffered events`);

      eventBufferRef.current.forEach(data => {
        processEvent(data);
      });

      eventBufferRef.current = [];
    }
  }, [isPaused]);

  // Helper function to process events
  const processEvent = (data: DocumentUpdateEvent) => {
    // Store all events for the log
    setEvents((prev) => [...prev, data]);

    if (data.type === 'DOCUMENT_UPDATED') {
      setJobs((prevJobs) => {
        const newJobs = new Map(prevJobs);
        const existingJob = newJobs.get(data.jobId);

        if (existingJob) {
          newJobs.set(data.jobId, {
            ...existingJob,
            status: data.status,
            ocrStatus: data.ocrStatus,
            thumbnailStatus: data.thumbnailStatus,
            startedAt: data.startedAt ? parseInt(data.startedAt) : existingJob.startedAt,
            finishedAt: data.finishedAt ? parseInt(data.finishedAt) : existingJob.finishedAt,
            ocrStartedAt: data.ocrStartedAt ? parseInt(data.ocrStartedAt) : existingJob.ocrStartedAt,
            ocrFinishedAt: data.ocrFinishedAt ? parseInt(data.ocrFinishedAt) : existingJob.ocrFinishedAt,
            thumbnailStartedAt: data.thumbnailStartedAt ? parseInt(data.thumbnailStartedAt) : existingJob.thumbnailStartedAt,
            thumbnailFinishedAt: data.thumbnailFinishedAt ? parseInt(data.thumbnailFinishedAt) : existingJob.thumbnailFinishedAt,
            updates: [...existingJob.updates, data],
          });
        } else {
          newJobs.set(data.jobId, {
            jobId: data.jobId,
            status: data.status,
            ocrStatus: data.ocrStatus,
            thumbnailStatus: data.thumbnailStatus,
            startedAt: data.startedAt ? parseInt(data.startedAt) : undefined,
            finishedAt: data.finishedAt ? parseInt(data.finishedAt) : undefined,
            ocrStartedAt: data.ocrStartedAt ? parseInt(data.ocrStartedAt) : undefined,
            ocrFinishedAt: data.ocrFinishedAt ? parseInt(data.ocrFinishedAt) : undefined,
            thumbnailStartedAt: data.thumbnailStartedAt ? parseInt(data.thumbnailStartedAt) : undefined,
            thumbnailFinishedAt: data.thumbnailFinishedAt ? parseInt(data.thumbnailFinishedAt) : undefined,
            updates: [data],
          });
        }

        return newJobs;
      });
    }
  };

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket Connected');
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data: DocumentUpdateEvent = JSON.parse(event.data);

        if (isPausedRef.current) {
          // Buffer the event when paused
          eventBufferRef.current.push(data);
          console.log(`Event buffered (${eventBufferRef.current.length} in buffer)`);
        } else {
          // Process immediately when not paused
          processEvent(data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      setConnectionStatus('disconnected');
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected');
      setConnectionStatus('disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  return {
    jobs: Array.from(jobs.values()).sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0)),
    events,
    connectionStatus,
    sessionStartTime,
  };
};
