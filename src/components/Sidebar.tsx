import React from 'react';
import {
  Compass,
  Home,
  Calendar,
  MapPin,
  Users,
  Copy,
  Check,
  Share2,
  Sparkles,
  MessageSquare,
  LogOut,
  ChevronDown,
  Layers,
  Flame,
  Radio,
  ExternalLink,
  Plane,
  DollarSign,
} from 'lucide-react';
import type { RoomState, Participant } from '../types/index.ts';

interface SidebarProps {
  currentTab: 'hub' | 'dates' | 'places' | 'itinerary' | 'transport' | 'budget';
  onSelectTab: (tab: 'hub' | 'dates' | 'places' | 'itinerary' | 'transport' | 'budget') => void;
  room: RoomState | null;
  currentUser: any;
  onSignIn: () => void;
  onSignOut: () => void;
  onNewRoom: () => void;
  onShowToast: (msg: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  room,
  currentUser,
  onSignIn,
  onSignOut,
  onNewRoom,
  onShowToast,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [copiedCode, setCopiedCode] = React.useState(false);

  const handleCopyCode = () => {
    if (!room?.code) return;
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    onShowToast(`Room code ${room.code} copied!`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const participantCount = room ? Object.keys(room.participants || {}).length : 0;
  const syncedCount = room
    ? Object.values(room.participants || {}).filter((p) => p.calendarSynced).length
    : 0;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#fcfbf9] border-r border-[#e8e6df] flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Logo */}
          <div className="h-14 px-5 flex items-center justify-between border-b border-[#e8e6df]">
            <div
              onClick={onNewRoom}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              {/* Radial burst icon reminiscent of Scalar Field logo */}
              <div className="w-7 h-7 rounded-md bg-[#181d27] text-white flex items-center justify-center font-bold text-xs tracking-tighter shadow-2xs group-hover:scale-105 transition-transform">
                <Compass className="w-4 h-4 text-emerald-400 -rotate-12" />
              </div>
              <span className="font-semibold text-base text-[#111827] tracking-tight font-serif">
                Splitroom
              </span>
            </div>

            <button
              onClick={onNewRoom}
              title="Create new trip room"
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-[#f2efe9] rounded-md transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="px-3 py-4 space-y-6">
            {/* Primary Navigation */}
            <div>
              <button
                onClick={() => {
                  onSelectTab('hub');
                  onCloseMobile?.();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  currentTab === 'hub'
                    ? 'bg-[#eae7df] text-gray-900 font-semibold'
                    : 'text-gray-600 hover:bg-[#f4f2ec] hover:text-gray-900'
                }`}
              >
                <Home className="w-4 h-4 text-gray-500" />
                <span>Trip Hub</span>
              </button>
            </div>

            {/* MY BOOK / TRIP PLANNING */}
            <div>
              <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                <span>Trip Planning</span>
                <ChevronDown className="w-3 h-3" />
              </div>

              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    onSelectTab('dates');
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentTab === 'dates'
                      ? 'bg-[#eae7df] text-gray-900 font-semibold'
                      : 'text-gray-600 hover:bg-[#f4f2ec] hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-500" />
                    <span>Best Dates</span>
                  </div>
                  {room && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-[#e5e2da] text-gray-600 font-mono">
                      {room.tripLengthNights}n
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    onSelectTab('places');
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentTab === 'places'
                      ? 'bg-[#eae7df] text-gray-900 font-semibold'
                      : 'text-gray-600 hover:bg-[#f4f2ec] hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-500" />
                    <span>Places & Vibes</span>
                  </div>
                  {room?.venues?.length ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-800 font-mono">
                      {room.venues.length}
                    </span>
                  ) : null}
                </button>

                <button
                  onClick={() => {
                    onSelectTab('itinerary');
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentTab === 'itinerary'
                      ? 'bg-[#eae7df] text-gray-900 font-semibold'
                      : 'text-gray-600 hover:bg-[#f4f2ec] hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Compass className="w-3.5 h-3.5 text-gray-500" />
                    <span>AI Itinerary</span>
                  </div>
                  <span className="text-[9px] uppercase px-1 py-0.2 rounded-xs bg-[#e2dfd5] text-gray-600 font-semibold">
                    Live
                  </span>
                </button>

                <button
                  onClick={() => {
                    onSelectTab('transport');
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentTab === 'transport'
                      ? 'bg-[#eae7df] text-gray-900 font-semibold'
                      : 'text-gray-600 hover:bg-[#f4f2ec] hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Plane className="w-3.5 h-3.5 text-gray-500" />
                    <span>Flights & Transport</span>
                  </div>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-xs bg-amber-100 text-amber-800 font-semibold">
                    New
                  </span>
                </button>

                <button
                  onClick={() => {
                    onSelectTab('budget');
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    currentTab === 'budget'
                      ? 'bg-[#eae7df] text-gray-900 font-semibold'
                      : 'text-gray-600 hover:bg-[#f4f2ec] hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <DollarSign className="w-3.5 h-3.5 text-gray-500" />
                    <span>Trip Budget</span>
                  </div>
                  {room?.budget && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-emerald-100 text-emerald-800 font-mono font-bold">
                      {room.budget.currencySymbol}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* THE DESK / ROOM DETAILS */}
            {room && (
              <div>
                <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  <span>Room Details</span>
                  <ChevronDown className="w-3 h-3" />
                </div>

                <div className="space-y-1 text-xs text-gray-600 px-3">
                  <div className="flex items-center justify-between py-1 border-b border-[#eeebdf]">
                    <span className="text-gray-500">Destination</span>
                    <span className="font-semibold text-gray-900 truncate max-w-[110px]">
                      {room.destination}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#eeebdf]">
                    <span className="text-gray-500">Window</span>
                    <span className="text-[11px] text-gray-800 font-mono">
                      {room.dateWindowStart.slice(5)} → {room.dateWindowEnd.slice(5)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-500">Creator</span>
                    <span className="text-gray-800 truncate max-w-[110px]">
                      {room.creatorName}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Room Promo / Share Card (Matching the Scalar Field 'Try Pro' card) */}
            {room ? (
              <div className="mx-1 p-3.5 rounded-xl bg-[#fbf6ea] border border-[#ebd8b0] text-[#714f14] shadow-2xs">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#634410]">
                      <Sparkles className="w-3.5 h-3.5 text-[#b27b1f]" />
                      <span>Room Code</span>
                    </div>
                    <p className="text-[11px] text-[#825c1a] mt-0.5 font-mono font-bold tracking-wider">
                      {room.code}
                    </p>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="w-7 h-7 rounded-full bg-[#f2e2be] hover:bg-[#e8d2a6] flex items-center justify-center text-[#634410] transition-colors cursor-pointer"
                    title="Copy Code"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="mt-2.5 pt-2 border-t border-[#ebd8b0]/70 flex items-center justify-between">
                  <span className="text-[10px] text-[#8c6724]">
                    {participantCount} in room
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="text-[10px] font-bold text-[#634410] flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>{copiedCode ? 'Copied' : 'Invite'}</span>
                    <Share2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mx-1 p-3.5 rounded-xl bg-[#fbf6ea] border border-[#ebd8b0] text-[#714f14]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#634410]">
                  <Flame className="w-3.5 h-3.5 text-[#b27b1f]" />
                  <span>Plan a Trip</span>
                </div>
                <p className="text-[11px] text-[#825c1a] mt-1 leading-relaxed">
                  Start a room or join your friends to vote on dates & places.
                </p>
              </div>
            )}

            {/* Sync Progress & Stats */}
            <div className="px-3 pt-2 text-xs border-t border-[#e8e6df]">
              <div className="flex items-center justify-between text-gray-500 mb-1.5">
                <span className="text-[11px] font-medium">Calendar Sync</span>
                <span className="text-[11px] font-mono text-gray-700 font-semibold">
                  {syncedCount} / {participantCount || 1}
                </span>
              </div>
              <div className="w-full bg-[#e8e5dc] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#181d27] h-full transition-all duration-300"
                  style={{
                    width: `${
                      participantCount > 0 ? (syncedCount / participantCount) * 100 : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-[#e8e6df] bg-[#f9f8f4]">
          {currentUser ? (
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-[#f0ede6] transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-8 h-8 rounded-full object-cover border border-[#d6d3c9]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#181d27] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {room?.creatorId === currentUser.uid ? 'Host Plan' : 'Free Member'}
                  </p>
                </div>
              </div>

              <button
                onClick={onSignOut}
                title="Sign Out"
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-[#e5e2da] rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="w-full py-2 px-3 bg-[#181d27] hover:bg-black text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Sign in with Google</span>
            </button>
          )}

          {/* Subfooter Links like Scalar Field */}
          <div className="flex items-center justify-center gap-4 mt-2 pt-2 text-[10px] text-gray-400 border-t border-[#eeebe2]">
            <span>Splitroom v1.0</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Room
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
