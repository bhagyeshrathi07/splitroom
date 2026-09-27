import React from 'react';
import { Copy, Check, Share2, Plus, Sparkles, Radio } from 'lucide-react';
import type { RoomState } from '../types/index.ts';

interface TopBannerProps {
  room: RoomState | null;
  onNewRoom: () => void;
  onShowToast: (msg: string) => void;
}

export const TopBanner: React.FC<TopBannerProps> = ({ room, onNewRoom, onShowToast }) => {
  const [copied, setCopied] = React.useState(false);

  if (!room) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    onShowToast(`Room code ${room.code} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    navigator.clipboard.writeText(url);
    onShowToast('Shareable link copied to clipboard!');
  };

  return (
    <div className="bg-[#fbf6ea] border border-[#ebd8b0] rounded-xl px-4 py-2.5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#714f14] shadow-2xs">
      {/* Left indicator & destination */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="flex items-center gap-1.5 font-bold text-[#553b0e]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Active Room: {room.destination}</span>
          <span>→</span>
        </span>
        <span className="text-[#8c6724]">
          {room.tripLengthNights} nights ({room.dateWindowStart} to {room.dateWindowEnd})
        </span>
        <span className="text-[#c7a76d] hidden md:inline">•</span>
        <div className="flex items-center gap-1 font-mono font-bold text-[#553b0e] bg-[#f5e7c8] px-2 py-0.5 rounded border border-[#ebd8b0]">
          <span>{room.code}</span>
          <button
            onClick={handleCopyCode}
            title="Copy room code"
            className="hover:text-black transition-colors cursor-pointer ml-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Right buttons styled like [Submit Strategy] and [+ Create Strategy] in Scalar Field */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleShareLink}
          className="px-3 py-1.5 bg-[#181d27] hover:bg-black text-white font-medium text-xs rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <Share2 className="w-3 h-3" />
          <span>Share Room</span>
        </button>

        <button
          onClick={onNewRoom}
          className="px-3 py-1.5 bg-white hover:bg-[#f6f4ee] text-gray-800 border border-[#e4e1d7] font-medium text-xs rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Room</span>
        </button>
      </div>
    </div>
  );
};
