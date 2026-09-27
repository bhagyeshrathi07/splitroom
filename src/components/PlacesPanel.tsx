import React, { useState, useMemo, useEffect } from 'react';
import {
  Compass,
  MapPin,
  Star,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Sparkles,
  Plus,
  Search,
  X,
  Loader2,
  Building,
  Utensils,
  Camera,
  Flame,
  Check,
  TrendingUp,
} from 'lucide-react';
import type { Venue } from '../types/index.ts';

interface PlacesPanelProps {
  destination: string;
  venues: Venue[];
  vibeNotes?: string[];
  currentUserId?: string;
  onVoteVenue?: (venueId: string, isUpvote: boolean) => Promise<void> | void;
  onAddVibe?: (vibe: string) => Promise<void> | void;
  onRemoveVibe?: (vibe: string) => Promise<void> | void;
  onGenerateVenues?: (vibe?: string) => Promise<void> | void;
  isGenerating?: boolean;
}

export const PlacesPanel: React.FC<PlacesPanelProps> = ({
  destination,
  venues = [],
  vibeNotes = [],
  currentUserId,
  onVoteVenue,
  onAddVibe,
  onRemoveVibe,
  onGenerateVenues,
  isGenerating: externalIsGenerating = false,
}) => {
  // Local state for instant optimistic vote tracking
  const [localUserVotes, setLocalUserVotes] = useState<{ [venueId: string]: 'up' | 'down' | null }>({});
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'lodging' | 'food' | 'activity' | 'top_voted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vibeInput, setVibeInput] = useState('');
  const [isInternalGenerating, setIsInternalGenerating] = useState(false);
  const [votingVenueId, setVotingVenueId] = useState<string | null>(null);

  const isGenerating = externalIsGenerating || isInternalGenerating;

  // Initialize and synchronize local vote state when venues change or user signs in
  useEffect(() => {
    if (!currentUserId) {
      setLocalUserVotes({});
      return;
    }

    const initialVotes: { [venueId: string]: 'up' | 'down' | null } = {};
    for (const v of venues) {
      if (v.upvotes?.includes(currentUserId)) {
        initialVotes[v.id] = 'up';
      } else if (v.downvotes?.includes(currentUserId)) {
        initialVotes[v.id] = 'down';
      } else {
        initialVotes[v.id] = null;
      }
    }
    setLocalUserVotes(initialVotes);
  }, [venues, currentUserId]);

  // Handle upvote / downvote click with optimistic local state
  const handleVoteClick = async (venueId: string, isUpvote: boolean) => {
    if (!currentUserId) {
      alert('Please sign in to vote on places for your group.');
      return;
    }

    const currentVote = localUserVotes[venueId];
    const newVote: 'up' | 'down' | null = isUpvote
      ? currentVote === 'up'
        ? null
        : 'up'
      : currentVote === 'down'
      ? null
      : 'down';

    // 1. Instant optimistic local state update
    setLocalUserVotes((prev) => ({
      ...prev,
      [venueId]: newVote,
    }));
    setVotingVenueId(venueId);

    // 2. Dispatch service call to backend
    try {
      if (onVoteVenue) {
        await onVoteVenue(venueId, isUpvote);
      }
    } catch (err) {
      console.error('Failed to vote:', err);
      // Revert on error
      setLocalUserVotes((prev) => ({
        ...prev,
        [venueId]: currentVote,
      }));
    } finally {
      setVotingVenueId(null);
    }
  };

  // Add Vibe tag handler
  const handleAddVibeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vibeInput.trim()) return;
    const cleanVibe = vibeInput.trim();
    setVibeInput('');
    if (onAddVibe) {
      setIsInternalGenerating(true);
      try {
        await onAddVibe(cleanVibe);
      } finally {
        setIsInternalGenerating(false);
      }
    }
  };

  // Trigger Google Maps Venue Generation
  const handleFetchVenues = async () => {
    if (onGenerateVenues) {
      setIsInternalGenerating(true);
      try {
        await onGenerateVenues();
      } finally {
        setIsInternalGenerating(false);
      }
    }
  };

  // Filter & sort venues
  const filteredVenues = useMemo(() => {
    return venues.filter((venue) => {
      // Category filter
      if (selectedCategory === 'top_voted') {
        const netScore = (venue.upvotes?.length || 0) - (venue.downvotes?.length || 0);
        if (netScore <= 0) return false;
      } else if (selectedCategory !== 'all' && venue.category !== selectedCategory) {
        return false;
      }

      // Search keyword filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = venue.name?.toLowerCase().includes(q);
        const matchesAddress = venue.address?.toLowerCase().includes(q);
        const matchesSummary = venue.summary?.toLowerCase().includes(q);
        const matchesCat = venue.category?.toLowerCase().includes(q);
        return matchesName || matchesAddress || matchesSummary || matchesCat;
      }

      return true;
    }).sort((a, b) => {
      // Sort by net votes first, then rating
      const scoreA = (a.upvotes?.length || 0) - (a.downvotes?.length || 0);
      const scoreB = (b.upvotes?.length || 0) - (b.downvotes?.length || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.rating || 0) - (a.rating || 0);
    });
  }, [venues, selectedCategory, searchQuery]);

  // Counts per category
  const lodgingCount = venues.filter((v) => v.category === 'lodging').length;
  const foodCount = venues.filter((v) => v.category === 'food').length;
  const activityCount = venues.filter((v) => v.category === 'activity').length;
  const topVotedCount = venues.filter((v) => (v.upvotes?.length || 0) - (v.downvotes?.length || 0) > 0).length;

  return (
    <div className="space-y-5">
      {/* 1. Header Bar with Title, Destination & Google Maps Action Button */}
      <div className="bg-white rounded-xl border border-[#e8e6df] p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-bold text-gray-900 tracking-tight">
              Google Maps Discovery in {destination}
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Grounded venue recommendations with live maps links, reviews, and group voting
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleFetchVenues}
            disabled={isGenerating}
            className="px-3.5 py-2 bg-[#181d27] hover:bg-black text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Grounding Maps...</span>
              </>
            ) : (
              <>
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                <span>{venues.length > 0 ? 'Refresh Venues' : 'Discover Venues'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Group Vibe Notes Bar (Adding vibe notes triggers re-generation) */}
      <div className="bg-white rounded-xl border border-[#e8e6df] p-3.5 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Group Vibes & Preferences</span>
          </div>
          <span className="text-[10px] text-gray-400">
            Adding vibes tailors Gemini's Google Maps search
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {vibeNotes.map((vibe, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#faf9f5] hover:bg-[#f2efe9] text-gray-800 px-2.5 py-1 rounded-lg border border-[#e4e1d7] transition-colors"
            >
              <span>#{vibe}</span>
              {onRemoveVibe && (
                <button
                  onClick={() => onRemoveVibe(vibe)}
                  title="Remove vibe note"
                  className="text-gray-400 hover:text-black cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}

          {/* Quick Add Vibe Input */}
          <form onSubmit={handleAddVibeSubmit} className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <input
              type="text"
              value={vibeInput}
              onChange={(e) => setVibeInput(e.target.value)}
              placeholder="Add vibe (e.g. 'walkable, rooftop bars, cheap, coffee')..."
              className="text-xs bg-[#faf9f5] border border-[#e4e1d7] rounded-lg px-2.5 py-1 text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-hidden focus:border-[#181d27] flex-1"
            />
            <button
              type="submit"
              disabled={!vibeInput.trim() || isGenerating}
              className="px-2.5 py-1 bg-white hover:bg-[#f6f4ee] border border-[#e4e1d7] text-gray-700 text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* 3. Category Filter Tabs & Keyword Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-[#181d27] text-white shadow-2xs'
                : 'bg-white hover:bg-[#f4f2ec] text-gray-700 border border-[#e4e1d7]'
            }`}
          >
            All Places ({venues.length})
          </button>

          <button
            onClick={() => setSelectedCategory('lodging')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
              selectedCategory === 'lodging'
                ? 'bg-[#181d27] text-white shadow-2xs'
                : 'bg-white hover:bg-[#f4f2ec] text-gray-700 border border-[#e4e1d7]'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-gray-400" />
            <span>Lodging ({lodgingCount})</span>
          </button>

          <button
            onClick={() => setSelectedCategory('food')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
              selectedCategory === 'food'
                ? 'bg-[#181d27] text-white shadow-2xs'
                : 'bg-white hover:bg-[#f4f2ec] text-gray-700 border border-[#e4e1d7]'
            }`}
          >
            <Utensils className="w-3.5 h-3.5 text-gray-400" />
            <span>Food & Drink ({foodCount})</span>
          </button>

          <button
            onClick={() => setSelectedCategory('activity')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
              selectedCategory === 'activity'
                ? 'bg-[#181d27] text-white shadow-2xs'
                : 'bg-white hover:bg-[#f4f2ec] text-gray-700 border border-[#e4e1d7]'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-gray-400" />
            <span>Activities ({activityCount})</span>
          </button>

          {topVotedCount > 0 && (
            <button
              onClick={() => setSelectedCategory('top_voted')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                selectedCategory === 'top_voted'
                  ? 'bg-amber-700 text-white shadow-2xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Top Voted ({topVotedCount})</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter venues..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#e4e1d7] rounded-lg text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-[#181d27]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-black cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Venues Grid */}
      {filteredVenues.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredVenues.map((venue) => {
            const userVote = localUserVotes[venue.id];
            const hasUpvoted = userVote === 'up' || (!userVote && currentUserId && venue.upvotes?.includes(currentUserId));
            const hasDownvoted = userVote === 'down' || (!userVote && currentUserId && venue.downvotes?.includes(currentUserId));

            // Optimistic vote count calculation
            const baseUpCount = venue.upvotes?.length || 0;
            const baseDownCount = venue.downvotes?.length || 0;
            const serverHadUp = currentUserId ? venue.upvotes?.includes(currentUserId) : false;
            const serverHadDown = currentUserId ? venue.downvotes?.includes(currentUserId) : false;

            let displayedUpCount = baseUpCount;
            if (userVote === 'up' && !serverHadUp) displayedUpCount += 1;
            if (userVote !== 'up' && serverHadUp) displayedUpCount = Math.max(0, displayedUpCount - 1);

            let displayedDownCount = baseDownCount;
            if (userVote === 'down' && !serverHadDown) displayedDownCount += 1;
            if (userVote !== 'down' && serverHadDown) displayedDownCount = Math.max(0, displayedDownCount - 1);

            const netScore = displayedUpCount - displayedDownCount;

            // Category badge styling
            let catBadge = {
              label: 'Activity',
              bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              icon: Camera,
            };
            if (venue.category === 'lodging') {
              catBadge = {
                label: 'Lodging',
                bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                icon: Building,
              };
            } else if (venue.category === 'food') {
              catBadge = {
                label: 'Food & Drink',
                bg: 'bg-amber-50 text-amber-800 border-amber-200',
                icon: Utensils,
              };
            }

            const CatIcon = catBadge.icon;

            return (
              <div
                key={venue.id}
                className="bg-white rounded-xl border border-[#e8e6df] p-4 shadow-2xs flex flex-col justify-between hover:border-[#cfcbc0] transition-all group"
              >
                <div>
                  {/* Top Badge Bar */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${catBadge.bg}`}
                    >
                      <CatIcon className="w-2.5 h-2.5" />
                      <span>{catBadge.label}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      {netScore > 0 && (
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          +{netScore}
                        </span>
                      )}

                      {venue.rating && (
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-800 bg-[#fef8ea] px-2 py-0.5 rounded-md border border-[#f5e4bd]">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          <span>{venue.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-sm text-gray-900 group-hover:text-black transition-colors mb-1 leading-snug">
                    {venue.name}
                  </h3>

                  {/* Address */}
                  {venue.address && (
                    <p className="text-[11px] text-gray-500 mb-2 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                      <span>{venue.address}</span>
                    </p>
                  )}

                  {/* 2-Sentence Summary */}
                  {venue.summary && (
                    <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed mb-3">
                      {venue.summary}
                    </p>
                  )}
                </div>

                {/* Card Footer: Google Maps Link + Interactive Upvote / Downvote Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-[#f2efe9] gap-2">
                  {/* Google Maps link with official Maps label */}
                  {venue.mapsUri ? (
                    <a
                      href={venue.mapsUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-black bg-[#faf9f5] hover:bg-[#f0ede6] px-2.5 py-1 rounded-lg border border-[#e4e1d7] transition-colors"
                      title="Open in Google Maps"
                    >
                      <Compass className="w-3 h-3 text-emerald-600" />
                      <span>Google Maps</span>
                      <ExternalLink className="w-2.5 h-2.5 text-gray-400" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-gray-400">Maps Grounded</span>
                  )}

                  {/* Upvote & Downvote Button Group */}
                  <div className="flex items-center gap-1.5">
                    {/* Upvote Button */}
                    <button
                      onClick={() => handleVoteClick(venue.id, true)}
                      disabled={votingVenueId === venue.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        hasUpvoted
                          ? 'bg-[#181d27] text-white shadow-2xs border border-[#181d27]'
                          : 'bg-white hover:bg-[#faf9f5] text-gray-700 border border-[#e4e1d7]'
                      }`}
                      title={hasUpvoted ? 'Remove upvote' : 'Upvote venue'}
                    >
                      <ThumbsUp className={`w-3 h-3 ${hasUpvoted ? 'fill-current' : ''}`} />
                      <span className="font-mono">{displayedUpCount}</span>
                    </button>

                    {/* Downvote Button */}
                    <button
                      onClick={() => handleVoteClick(venue.id, false)}
                      disabled={votingVenueId === venue.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        hasDownvoted
                          ? 'bg-rose-600 text-white shadow-2xs border border-rose-600'
                          : 'bg-white hover:bg-[#faf9f5] text-gray-700 border border-[#e4e1d7]'
                      }`}
                      title={hasDownvoted ? 'Remove downvote' : 'Downvote venue'}
                    >
                      <ThumbsDown className={`w-3 h-3 ${hasDownvoted ? 'fill-current' : ''}`} />
                      {displayedDownCount > 0 && (
                        <span className="font-mono">{displayedDownCount}</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#faf9f5] border border-[#f0ede6] text-[#714f14] mx-auto flex items-center justify-center mb-3.5">
            <Compass className="w-6 h-6 text-[#8c6724]" />
          </div>

          <h3 className="font-bold text-sm text-gray-900 mb-1">
            {searchQuery ? 'No Venues Match Your Search' : `Explore Venues in ${destination}`}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-5 leading-relaxed">
            {searchQuery
              ? `Try adjusting your search terms or clearing the filter.`
              : `Gemini will search Google Maps for top-rated lodging, food spots, and activities tailored to ${destination} and your group's vibe notes.`}
          </p>

          {searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-3.5 py-1.5 bg-[#181d27] text-white text-xs font-medium rounded-lg hover:bg-black transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={handleFetchVenues}
              disabled={isGenerating}
              className="px-4 py-2 bg-[#181d27] hover:bg-black text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Curating Places with Maps...</span>
                </>
              ) : (
                <>
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Search Venues in {destination}</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
