import React from 'react';
import { Users, Crown, CalendarCheck2, LogOut, ArrowRight, ShieldCheck } from 'lucide-react';
import type { Participant } from '../types/index.ts';

interface ParticipantsListProps {
  participants: { [uid: string]: Participant };
  creatorId: string;
  currentUserId?: string;
  onLeaveRoom: () => void;
  onSyncCalendarPrompt?: () => void;
}

export const ParticipantsList: React.FC<ParticipantsListProps> = ({
  participants,
  creatorId,
  currentUserId,
  onLeaveRoom,
  onSyncCalendarPrompt,
}) => {
  const participantList = Object.values(participants || {});
  const onlineCount = participantList.filter((p) => p.online).length;
  const currentParticipant = currentUserId ? participants[currentUserId] : null;

  return (
    <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#f2efe9] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#f4f2ec] text-[#181d27] flex items-center justify-center font-bold text-xs">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900">Room Participants</h3>
            <p className="text-[11px] text-gray-400">
              {participantList.length} member{participantList.length === 1 ? '' : 's'} • {onlineCount} active now
            </p>
          </div>
        </div>

        {currentParticipant && (
          <button
            onClick={onLeaveRoom}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-200"
            title="Leave room and delete your data"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        )}
      </div>

      {/* Participants List */}
      <div className="p-4 divide-y divide-[#f2efe9]">
        {participantList.map((participant) => {
          const isCreator = participant.uid === creatorId;
          const isCurrent = participant.uid === currentUserId;

          return (
            <div
              key={participant.uid}
              className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  {participant.photoURL ? (
                    <img
                      src={participant.photoURL}
                      alt={participant.displayName}
                      className="w-9 h-9 rounded-full object-cover border border-[#e4e1d7]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#181d27] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                      {(participant.displayName || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      participant.online ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-xs text-gray-900 truncate">
                      {participant.displayName}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-[#f0ede6] text-gray-700 rounded">
                        You
                      </span>
                    )}
                    {isCreator && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.2 bg-[#fbf6ea] text-[#714f14] rounded border border-[#ebd8b0]">
                        <Crown className="w-2.5 h-2.5 text-amber-600" />
                        Host
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    {participant.calendarSynced ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <CalendarCheck2 className="w-3 h-3" />
                        Calendar Synced
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">
                        Calendar not yet linked
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={`text-[11px] font-medium ${
                    participant.online ? 'text-emerald-600' : 'text-gray-400'
                  }`}
                >
                  {participant.online ? 'Active' : 'Offline'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync Callout for Current User */}
      {currentParticipant && !currentParticipant.calendarSynced && onSyncCalendarPrompt && (
        <div className="p-3.5 m-3 bg-[#fbf6ea] border border-[#ebd8b0] rounded-xl flex items-center justify-between gap-3 text-[#714f14]">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#5c3e0e]">Sync availability</p>
            <p className="text-[11px] text-[#855e1a] truncate">
              Google Calendar free/busy intervals for group matching.
            </p>
          </div>
          <button
            onClick={onSyncCalendarPrompt}
            className="shrink-0 text-xs font-medium px-3 py-1.5 bg-[#181d27] hover:bg-black text-white rounded-lg transition-colors cursor-pointer"
          >
            Sync
          </button>
        </div>
      )}
    </div>
  );
};
