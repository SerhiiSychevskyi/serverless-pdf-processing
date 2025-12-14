import { DocumentUpdateEvent } from '../types';
import { useState } from 'react';

interface EventLogProps {
  events: DocumentUpdateEvent[];
}

export const EventLog = ({ events }: EventLogProps) => {
  return (
    <div className="h-full flex flex-col bg-slate-800 rounded-lg border border-slate-700 overflow-hidden mt-4">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-900 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Event Log ({events.length} events)
        </h2>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            No events received yet...
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {events.slice().reverse().map((event, index) => (
              <EventRow key={events.length - index - 1} event={event} index={events.length - index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface EventRowProps {
  event: DocumentUpdateEvent;
  index: number;
}

const EventRow = ({ event, index }: EventRowProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatTime = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  return (
    <div className="hover:bg-slate-750">
      <div
        className="px-4 py-2 flex items-center gap-3 cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <span className="text-xs text-slate-500 w-12">#{index + 1}</span>
        <span className="text-xs font-mono text-slate-400 w-32">
          {event.updatedAt ? formatTime(event.updatedAt) : 'N/A'}
        </span>
        <span className="text-xs font-mono text-slate-300 flex-1">
          {event.jobId.substring(0, 12)}
        </span>
        <span className={`text-xs px-2 py-1 rounded ${
          event.eventName === 'INSERT' ? 'bg-blue-600' :
          event.eventName === 'MODIFY' ? 'bg-yellow-600' : 'bg-red-600'
        } text-white`}>
          {event.eventName}
        </span>
        <span className="text-xs text-slate-400">
          {event.status} | OCR: {event.ocrStatus} | Thumb: {event.thumbnailStatus}
        </span>
        <button className="text-slate-500 hover:text-white text-xs">
          {showDetails ? '▼' : '▶'}
        </button>
      </div>

      {showDetails && (
        <div className="px-4 pb-3 bg-slate-900">
          <pre className="text-xs text-slate-300 overflow-x-auto p-3 bg-slate-950 rounded">
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
