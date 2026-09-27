import React from 'react';
import { CheckCircle2, Circle, Users, CalendarCheck2, ArrowUpRight, Plus, Calendar, Clock, LogOut } from 'lucide-react';
import type { RoomState, Participant } from '../types/index.ts';

interface RightSidebarProps {
  room: RoomState | null;
  currentUser: any;
  onSyncCalendar?: () => void;
  onLeaveRoom?: () => void;
  onShowToast: (msg: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  room,
  currentUser,
  onSyncCalendar,
  onLeaveRoom,
  onShowToast,
}) => {
  if (!room) return null;

  const participants = Object.values(room.participants || {});
  const currentParticipant = currentUser ? room.participants[currentUser.uid] : null;

  // Compute "Get Started" checklist progress
  const hasCreatedRoom = !!room.code;
  const hasMultipleMembers = participants.length > 1;
  const hasSyncedCalendar = !!currentParticipant?.calendarSynced;
  const hasDateVotes = room.dateCandidates?.some((c) => Object.keys(c.votes || {}).length > 0);
  const hasVenueVotes = room.venues?.some((v) => (v.upvotes?.length || 0) + (v.downvotes?.length || 0) > 0);

  const steps = [
    { title: 'Create group room', completed: hasCreatedRoom },
    { title: 'Invite travel companions', completed: hasMultipleMembers },
    { title: 'Sync Google Calendar', completed: hasSyncedCalendar },
    { title: 'Vote on date windows', completed: hasDateVotes },
    { title: 'Vote on Google Maps places', completed: hasVenueVotes },
  ];

  const completedCount = steps.filter((s) => s.completed).length;

  const copyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    navigator.clipboard.writeText(url);
    onShowToast('Invite link copied to clipboard!');
  };

  return (
    <div className="w-80 shrink-0 space-y-6 hidden xl:block">
      {/* 1. GET STARTED CHECKLIST (Matching Scalar Field's GET STARTED widget) */}
      <div className="bg-white rounded-xl border border-[#e8e6df] p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
            <CalendarCheck2 className="w-3.5 h-3.5 text-gray-400" />
            <span>Trip Checklist</span>
          </div>
          <span className="text-xs font-mono font-medium text-gray-500">
            {completedCount} / {steps.length}
          </span>
        </div>

        {/* Progress bar with terracotta / orange-amber fill */}
        <div className="w-full bg-[#f0ede6] h-1.5 rounded-full overflow-hidden mb-3.5">
          <div
            className="bg-[#d97706] h-full transition-all duration-300"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>

        <p className="text-[11px] text-gray-400 mb-3">
          Coordinate schedules and pick the best weekend with your group
        </p>

        {/* Steps list */}
        <div className="space-y-2.5">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2.5 text-xs">
              {step.completed ? (
                <div className="w-4 h-4 rounded-full bg-[#d97706] text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center shrink-0">
                  <Circle className="w-2.5 h-2.5 text-gray-300" />
                </div>
              )}
              <span
                className={
                  step.completed
                    ? 'text-gray-700 font-medium line-through opacity-80'
                    : 'text-gray-700'
                }
              >
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. THE BOOK / ROSTER (Matching Scalar Field's THE BOOK widget) */}
      <div className="bg-white rounded-xl border border-[#e8e6df] p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f2efe9]">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Trip Roster
            </div>
            <div className="text-xl font-bold text-gray-900 font-serif tracking-tight mt-0.5">
              {participants.length} {participants.length === 1 ? 'Member' : 'Members'}
            </div>
          </div>
          <button
            onClick={copyShareLink}
            className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-0.5 font-medium cursor-pointer"
          >
            <span>Invite</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Member Items */}
        <div className="space-y-2 mb-4 max-h-56 overflow-y-auto pr-1">
          {participants.map((member) => (
            <div
              key={member.uid}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#faf9f5] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative shrink-0">
                  {member.photoURL ? (
                    <img
                      src={member.photoURL}
                      alt={member.displayName}
                      className="w-7 h-7 rounded-full object-cover border border-[#e4e1d7]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#181d27] text-white flex items-center justify-center font-bold text-[10px]">
                      {(member.displayName || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${
                      member.online ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {member.displayName}
                    {member.uid === currentUser?.uid && (
                      <span className="ml-1 text-[10px] text-gray-400">(You)</span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {member.calendarSynced ? 'Synced' : 'Pending'}
                  </p>
                </div>
              </div>

              <div>
                {member.calendarSynced ? (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Synced
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">Offline</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons styled like [+ Add Venue] and [Fund Wallet] */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#f2efe9]">
          <button
            onClick={copyShareLink}
            className="w-full py-2 px-3 bg-white hover:bg-[#faf9f5] border border-[#e4e1d7] text-gray-800 text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-gray-500" />
            <span>Add Friend</span>
          </button>

          <button
            onClick={onSyncCalendar}
            className="w-full py-2 px-3 bg-[#181d27] hover:bg-black text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Sync Cal</span>
          </button>
        </div>
      </div>

      {/* 3. RECENT ACTIVITY LOGS (Matching the FILLED SELL / ORDER_PLACED logs) */}
      <div className="bg-white rounded-xl border border-[#e8e6df] p-4 shadow-2xs text-xs">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">
          Live Room Activity
        </div>

        <div className="space-y-2.5 text-[11px] text-gray-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900">ROOM_INITIALIZED</p>
              <p className="text-[10px] text-gray-400">{room.destination} ({room.tripLengthNights} nights)</p>
            </div>
            <span className="text-[10px] text-gray-400">Now</span>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900">HOST_JOINED</p>
              <p className="text-[10px] text-gray-400">{room.creatorName}</p>
            </div>
            <span className="text-[10px] text-gray-400">Live</span>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900">SSE_STREAM_ONLINE</p>
              <p className="text-[10px] text-emerald-600">Syncing with zero refresh</p>
            </div>
            <span className="text-[10px] text-emerald-600 font-bold">● Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
