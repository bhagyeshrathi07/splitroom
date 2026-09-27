import React, { useState, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  ThumbsUp,
  Users,
  ChevronRight,
  TrendingUp,
  Award,
  Check,
  ArrowUpDown,
  Filter,
  UserCheck,
} from 'lucide-react';
import type { DateCandidate, Participant } from '../types/index.ts';

interface DatesPanelProps {
  dateCandidates: DateCandidate[];
  tripLengthNights: number;
  dateWindowStart: string;
  dateWindowEnd: string;
  currentUserId?: string;
  participants?: { [uid: string]: Participant };
  onVoteDate?: (candidateId: string) => void;
  onSyncPrompt?: () => void;
  isCalendarSynced?: boolean;
}

type SortOption = 'votes' | 'availability' | 'date';

export const DatesPanel: React.FC<DatesPanelProps> = ({
  dateCandidates = [],
  tripLengthNights,
  dateWindowStart,
  dateWindowEnd,
  currentUserId,
  participants = {},
  onVoteDate,
  onSyncPrompt,
  isCalendarSynced,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('votes');
  const [onlyMyVotes, setOnlyMyVotes] = useState<boolean>(false);

  const totalParticipantsCount = Object.keys(participants).length || 1;

  // Calculate highest vote count among all candidates
  const maxVoteCount = useMemo(() => {
    return dateCandidates.reduce((max, c) => {
      const votes = Object.values(c.votes || {}).filter(Boolean).length;
      return Math.max(max, votes);
    }, 0);
  }, [dateCandidates]);

  // Total unique members who voted on at least one candidate
  const uniqueVoterUids = useMemo(() => {
    const voterSet = new Set<string>();
    dateCandidates.forEach((c) => {
      Object.entries(c.votes || {}).forEach(([uid, voted]) => {
        if (voted) voterSet.add(uid);
      });
    });
    return Array.from(voterSet);
  }, [dateCandidates]);

  // Sort and filter candidates
  const processedCandidates = useMemo(() => {
    let list = [...dateCandidates];

    if (onlyMyVotes && currentUserId) {
      list = list.filter((c) => Boolean(c.votes?.[currentUserId]));
    }

    list.sort((a, b) => {
      const aVotes = Object.values(a.votes || {}).filter(Boolean).length;
      const bVotes = Object.values(b.votes || {}).filter(Boolean).length;

      if (sortBy === 'votes') {
        if (bVotes !== aVotes) return bVotes - aVotes;
        if (b.freeCount !== a.freeCount) return b.freeCount - a.freeCount;
        return a.startDate.localeCompare(b.startDate);
      }

      if (sortBy === 'availability') {
        if (b.freeCount !== a.freeCount) return b.freeCount - a.freeCount;
        if (bVotes !== aVotes) return bVotes - aVotes;
        return a.startDate.localeCompare(b.startDate);
      }

      // 'date'
      return a.startDate.localeCompare(b.startDate);
    });

    return list;
  }, [dateCandidates, sortBy, onlyMyVotes, currentUserId]);

  return (
    <div className="space-y-4">
      {/* 1. Header & Group Consensus Stats Banner */}
      <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 tracking-tight">
                Optimal Date Windows & Voting
              </h2>
              <span className="text-[10px] font-mono font-medium text-gray-600 bg-[#f0ede6] px-2.5 py-0.5 rounded-full border border-[#e4e1d7]">
                {dateCandidates.length} Proposed
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Vote on preferred date windows for a {tripLengthNights}-night stay. Consensus updates live for all members.
            </p>
          </div>

          {/* Group Voting Participation Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-[#faf9f5] border border-[#e8e6df] rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-gray-600 font-medium">Group Voting:</span>
              <span className="font-bold text-gray-900 font-mono">
                {uniqueVoterUids.length} / {totalParticipantsCount}
              </span>
              <span className="text-[11px] text-gray-400">members active</span>
            </div>
          </div>
        </div>

        {/* 2. Sort & Filter Controls */}
        {dateCandidates.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-[#f0ede6] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium text-gray-600">Sort by:</span>
              <button
                type="button"
                onClick={() => setSortBy('votes')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  sortBy === 'votes'
                    ? 'bg-[#181d27] text-white shadow-2xs font-semibold'
                    : 'bg-[#faf9f5] hover:bg-gray-100 text-gray-700 border border-[#e4e1d7]'
                }`}
              >
                👍 Most Voted {maxVoteCount > 0 ? `(${maxVoteCount} max)` : ''}
              </button>
              <button
                type="button"
                onClick={() => setSortBy('availability')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  sortBy === 'availability'
                    ? 'bg-[#181d27] text-white shadow-2xs font-semibold'
                    : 'bg-[#faf9f5] hover:bg-gray-100 text-gray-700 border border-[#e4e1d7]'
                }`}
              >
                👥 Best Availability
              </button>
              <button
                type="button"
                onClick={() => setSortBy('date')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  sortBy === 'date'
                    ? 'bg-[#181d27] text-white shadow-2xs font-semibold'
                    : 'bg-[#faf9f5] hover:bg-gray-100 text-gray-700 border border-[#e4e1d7]'
                }`}
              >
                📅 Chronological
              </button>
            </div>

            {currentUserId && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyMyVotes}
                  onChange={(e) => setOnlyMyVotes(e.target.checked)}
                  className="rounded border-gray-300 text-[#181d27] focus:ring-black"
                />
                <span>Show only windows I voted for</span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* 3. Date Candidates Cards List */}
      {processedCandidates.length > 0 ? (
        <div className="space-y-3.5">
          {processedCandidates.map((candidate, idx) => {
            const activeVoterUids = Object.entries(candidate.votes || {})
              .filter(([_, voted]) => Boolean(voted))
              .map(([uid]) => uid);

            const totalVotes = activeVoterUids.length;
            const hasVoted = Boolean(currentUserId && candidate.votes?.[currentUserId]);
            const isLeader = maxVoteCount > 0 && totalVotes === maxVoteCount;
            const votePercent = Math.round((totalVotes / Math.max(1, totalParticipantsCount)) * 100);

            // Names of voters
            const voterNames = activeVoterUids.map((uid) => {
              if (uid === currentUserId) return 'You';
              return participants[uid]?.displayName || 'Member';
            });

            return (
              <div
                key={candidate.id}
                className={`bg-white rounded-xl border transition-all p-5 shadow-2xs ${
                  hasVoted
                    ? 'border-emerald-300 ring-1 ring-emerald-200/60 bg-gradient-to-b from-emerald-50/20 to-white'
                    : isLeader
                    ? 'border-amber-300 bg-gradient-to-b from-amber-50/20 to-white'
                    : 'border-[#e8e6df] hover:border-[#d9d6cb]'
                }`}
              >
                {/* Header of Candidate Card */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${
                        hasVoted
                          ? 'bg-emerald-600 text-white'
                          : isLeader
                          ? 'bg-amber-500 text-white'
                          : 'bg-[#f4f2ec] text-[#181d27]'
                      }`}
                    >
                      <Calendar className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-gray-900 tracking-tight">
                          {candidate.startDate} → {candidate.endDate}
                        </h3>

                        {/* Leading Vote Consensus Badge */}
                        {isLeader && (
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                            <Award className="w-3 h-3 text-amber-700" />
                            <span>Consensus Leader</span>
                          </span>
                        )}

                        {/* Top Availability Choice Badge */}
                        {idx === 0 && !isLeader && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ● Top Availability Match
                          </span>
                        )}

                        {/* My Vote Badge Indicator */}
                        {hasVoted && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-700" />
                            <span>Your Vote Cast</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-0.5">
                        {candidate.nights} nights stay • {candidate.weekendNights} weekend night{candidate.weekendNights === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  {/* Prominent Vote Count Pill Indicator */}
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                        hasVoted
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs'
                          : totalVotes > 0
                          ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                          : 'bg-[#faf9f5] border-[#e8e6df] text-gray-600'
                      }`}
                    >
                      <ThumbsUp
                        className={`w-4 h-4 ${
                          hasVoted
                            ? 'text-emerald-700 fill-emerald-600'
                            : totalVotes > 0
                            ? 'text-amber-600'
                            : 'text-gray-400'
                        }`}
                      />
                      <div className="flex flex-col text-right leading-none">
                        <span className="text-sm font-bold font-mono">
                          {totalVotes} {totalVotes === 1 ? 'Vote' : 'Votes'}
                        </span>
                        <span className="text-[9px] font-medium opacity-75 mt-0.5">
                          {votePercent}% consensus
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Vote Progress Bar */}
                <div className="mb-3.5">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                    <span className="font-medium">
                      Group Agreement: <span className="font-bold text-gray-800">{totalVotes} of {totalParticipantsCount}</span> members
                    </span>
                    <span className="font-mono font-semibold text-gray-700">{votePercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#f0ede6] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        votePercent === 100
                          ? 'bg-emerald-600'
                          : votePercent >= 50
                          ? 'bg-emerald-500'
                          : totalVotes > 0
                          ? 'bg-amber-500'
                          : 'bg-gray-300'
                      }`}
                      style={{ width: `${Math.max(4, votePercent)}%` }}
                    />
                  </div>
                </div>

                {/* Voter Avatars / Names Pill List */}
                {totalVotes > 0 && (
                  <div className="mb-3 p-2.5 bg-[#faf9f5] border border-[#f0ece3] rounded-lg flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-semibold text-gray-700 shrink-0 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-gray-500" />
                      Voted by:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {voterNames.map((name, vIdx) => (
                        <span
                          key={vIdx}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                            name === 'You'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                              : 'bg-white text-gray-700 border-gray-200'
                          }`}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gemini AI Summary Reason / Insight */}
                {candidate.reason && (
                  <p className="text-xs text-gray-600 bg-[#fbfbfa] border border-[#f0ece3] rounded-lg p-3 mb-3.5 leading-relaxed">
                    <span className="font-semibold text-gray-800">✨ AI Schedule Insight: </span>
                    {candidate.reason}
                  </p>
                )}

                {/* 4-Metric Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2.5 border-y border-[#f2efe9] text-center my-3 bg-[#fdfcfa] rounded-lg">
                  <div className="px-2">
                    <span className="block text-[10px] uppercase font-semibold text-gray-400">
                      Free Members
                    </span>
                    <span className="text-xs font-bold text-emerald-600 font-mono">
                      {candidate.freeCount} / {candidate.totalSynced || totalParticipantsCount}
                    </span>
                  </div>

                  <div className="px-2 border-l border-[#f2efe9]">
                    <span className="block text-[10px] uppercase font-semibold text-gray-400">
                      Weekend Coverage
                    </span>
                    <span className="text-xs font-bold text-gray-800 font-mono">
                      {candidate.weekendNights} night{candidate.weekendNights === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="px-2 border-l border-[#f2efe9]">
                    <span className="block text-[10px] uppercase font-semibold text-gray-400">
                      Group Votes
                    </span>
                    <span className={`text-xs font-bold font-mono ${totalVotes > 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {totalVotes} ({votePercent}%)
                    </span>
                  </div>

                  <div className="px-2 border-l border-[#f2efe9]">
                    <span className="block text-[10px] uppercase font-semibold text-gray-400">
                      Availability
                    </span>
                    <span className="text-xs font-bold text-indigo-600">
                      {candidate.freeCount === (candidate.totalSynced || totalParticipantsCount)
                        ? '100% Free'
                        : 'Partial Free'}
                    </span>
                  </div>
                </div>

                {/* Bottom Actions: Members Free Breakdown & Toggle Vote Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
                    <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">
                      <strong className="text-gray-700">Free:</strong>{' '}
                      {candidate.freeMembers.length > 0
                        ? candidate.freeMembers.join(', ')
                        : 'All synced'}
                    </span>
                  </div>

                  {/* Toggle Vote Button */}
                  <button
                    type="button"
                    onClick={() => onVoteDate?.(candidate.id)}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                      hasVoted
                        ? 'bg-[#181d27] text-white hover:bg-rose-700 border border-[#181d27] hover:border-rose-700 group'
                        : 'bg-white hover:bg-emerald-50 text-gray-800 hover:text-emerald-800 border border-[#e4e1d7] hover:border-emerald-300'
                    }`}
                  >
                    {hasVoted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:hidden" />
                        <span className="group-hover:hidden">Voted for this Window</span>
                        <span className="hidden group-hover:inline text-white">Click to Remove Vote</span>
                      </>
                    ) : (
                      <>
                        <ThumbsUp className="w-3.5 h-3.5 text-gray-500" />
                        <span>Vote for this Window</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#faf9f5] border border-[#f0ede6] text-[#714f14] mx-auto flex items-center justify-center mb-3.5">
            <Calendar className="w-6 h-6 text-[#8c6724]" />
          </div>

          <h3 className="font-bold text-sm text-gray-900 mb-1">
            {onlyMyVotes ? 'No Voted Date Windows Yet' : 'No Date Windows Proposed Yet'}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-5 leading-relaxed">
            {onlyMyVotes
              ? 'You have not voted on any date candidates yet. Uncheck the filter above to view all windows.'
              : `Connect your Google Calendar or availability between ${dateWindowStart} and ${dateWindowEnd} to generate and vote on candidate windows.`}
          </p>

          {onlyMyVotes ? (
            <button
              type="button"
              onClick={() => setOnlyMyVotes(false)}
              className="px-4 py-2 bg-[#181d27] hover:bg-black text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Show All Date Windows
            </button>
          ) : (
            !isCalendarSynced &&
            onSyncPrompt && (
              <button
                type="button"
                onClick={onSyncPrompt}
                className="px-4 py-2 bg-[#181d27] hover:bg-black text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Sync Calendar Availability</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
