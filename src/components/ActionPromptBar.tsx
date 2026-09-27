import React, { useState } from 'react';
import {
  Calendar,
  Sparkles,
  MapPin,
  Paperclip,
  ArrowRight,
  SlidersHorizontal,
  Flame,
  Mic,
  Moon,
} from 'lucide-react';
import type { RoomState } from '../types/index.ts';

interface ActionPromptBarProps {
  room: RoomState | null;
  onSubmitVibe?: (vibe: string) => void;
  onSyncCalendar?: () => void;
  onSelectTab?: (tab: 'hub' | 'dates' | 'places' | 'itinerary') => void;
}

export const ActionPromptBar: React.FC<ActionPromptBarProps> = ({
  room,
  onSubmitVibe,
  onSyncCalendar,
  onSelectTab,
}) => {
  const [input, setInput] = useState('');
  const [liveSync, setLiveSync] = useState(true);

  if (!room) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSubmitVibe?.(input.trim());
    setInput('');
  };

  return (
    <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-4 mb-6">
      {/* Top micro-bar inside prompt box (matching "You have exhausted all of your credits...") */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2 pb-2 border-b border-[#f2efe9]">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Trip Workspace</span>
          <span className="text-gray-300">•</span>
          <span className="text-[11px] text-gray-500">
            {room.destination} ({room.tripLengthNights} nights)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Multiplayer
          </span>
        </div>
      </div>

      {/* Main input prompt */}
      <form onSubmit={handleSubmit}>
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Add a vibe note or preference for ${room.destination} (e.g. "near walkable coffee shops, cheap, rooftop views, no seafood")...`}
          className="w-full text-sm text-gray-800 placeholder-gray-400 bg-transparent resize-none focus:outline-hidden leading-relaxed"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />

        {/* Bottom toolbar inside prompt box matching Scalar Field pills */}
        <div className="flex items-center justify-between pt-2 border-t border-[#f2efe9] gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Paperclip */}
            <button
              type="button"
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-[#f5f3ec] transition-colors cursor-pointer"
              title="Attach notes"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>

            {/* Pill 1: Sync Calendar */}
            <button
              type="button"
              onClick={onSyncCalendar}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#f6f4ee] border border-[#e4e1d7] rounded-lg text-xs font-medium text-gray-700 transition-colors cursor-pointer shadow-2xs"
            >
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <span>Sync Calendar</span>
            </button>

            {/* Pill 2: Trip length */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#fbf9f4] border border-[#e8e6df] rounded-lg text-xs font-medium text-gray-700 shadow-2xs">
              <Moon className="w-3.5 h-3.5 text-gray-500" />
              <span>{room.tripLengthNights} Nights</span>
            </div>

            {/* Pill 3: Live Toggle styled like the "Ultra" toggle in the screenshot */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#e4e1d7] rounded-lg text-xs font-medium text-gray-700 shadow-2xs">
              <span className="text-[11px] font-semibold text-gray-600">Auto Sync</span>
              <button
                type="button"
                onClick={() => setLiveSync(!liveSync)}
                className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  liveSync ? 'bg-[#181d27]' : 'bg-gray-200'
                }`}
              >
                <div
                  className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${
                    liveSync ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Right submit button styled as circular charcoal arrow */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-[#f5f3ec] transition-colors cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>

            <button
              type="submit"
              disabled={!input.trim()}
              className="w-7 h-7 rounded-full bg-[#181d27] hover:bg-black disabled:bg-gray-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
