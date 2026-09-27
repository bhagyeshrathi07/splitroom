import React, { useState } from 'react';
import { MapPin, Moon, Calendar, Copy, Check, Share2, Sparkles, Users } from 'lucide-react';
import type { RoomState } from '../types/index.ts';

interface RoomHeaderProps {
  room: RoomState;
  activeTab: 'hub' | 'dates' | 'places' | 'itinerary' | 'transport';
  onSelectTab: (tab: 'hub' | 'dates' | 'places' | 'itinerary' | 'transport') => void;
  onShowToast: (msg: string) => void;
  currentUserName?: string;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  room,
  activeTab,
  onSelectTab,
  onShowToast,
  currentUserName,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    onShowToast(`Room code ${room.code} copied!`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const tabs: { id: 'hub' | 'dates' | 'places' | 'itinerary' | 'transport'; label: string; badge?: string }[] = [
    { id: 'hub', label: 'Trip Hub' },
    { id: 'dates', label: 'Dates & Votes', badge: `${room.dateCandidates?.length || 0}` },
    { id: 'places', label: 'Places & Vibes', badge: `${room.venues?.length || 0}` },
    { id: 'itinerary', label: 'AI Itinerary', badge: room.itinerary ? 'Ready' : undefined },
    { id: 'transport', label: 'Flights & Transit', badge: room.transportPlans?.length ? `${room.transportPlans.length}` : undefined },
  ];

  return (
    <div className="mb-6">
      {/* Title & Greeting matching Scalar Field ("Good morning, Bhagyesh") */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight font-serif">
            {currentUserName ? `Planning with ${currentUserName}` : `Trip to ${room.destination}`}
          </h1>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>
              {room.destination} • {room.tripLengthNights} nights stay between {room.dateWindowStart} and{' '}
              {room.dateWindowEnd}
            </span>
            <a
              href={
                room.coordinates
                  ? `https://www.openstreetmap.org/?mlat=${room.coordinates.lat}&mlon=${room.coordinates.lng}#map=12/${room.coordinates.lat}/${room.coordinates.lng}`
                  : `https://www.openstreetmap.org/search?query=${encodeURIComponent(room.destination)}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded font-medium transition-colors"
              title="View destination on OpenStreetMap"
            >
              <MapPin className="w-2.5 h-2.5 text-emerald-600" />
              <span>OpenStreetMap</span>
            </a>
          </p>
        </div>

        {/* Room Code Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 bg-white border border-[#e4e1d7] rounded-lg px-2.5 py-1 text-xs font-mono text-gray-800 shadow-2xs">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Room</span>
            <span className="font-bold">{room.code}</span>
            <button
              onClick={copyCode}
              title="Copy room code"
              className="text-gray-400 hover:text-black cursor-pointer ml-1"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Tab Navigation (Matching Scalar Field's "My Book", "The Desk", "Research") */}
      <div className="flex items-center border-b border-[#e8e6df] gap-6 text-xs font-medium">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`pb-2.5 relative flex items-center gap-1.5 transition-colors cursor-pointer ${
                isActive
                  ? 'text-gray-900 font-bold border-b-2 border-[#181d27]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-xs font-mono ${
                    isActive ? 'bg-[#181d27] text-white' : 'bg-[#f0ede6] text-gray-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
