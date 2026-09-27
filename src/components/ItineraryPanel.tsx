import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Layers,
  ArrowRight,
  Compass,
  Share2,
  Map,
  List,
  Navigation,
  CheckCircle2,
} from 'lucide-react';
import type { Itinerary, ItineraryDay, ItineraryStop, RoomState } from '../types/index.ts';
import { ItineraryMap } from './ItineraryMap.tsx';
import { Export } from './Export.tsx';

interface ItineraryPanelProps {
  room: RoomState;
  onGenerateItinerary: () => Promise<void>;
  isGenerating?: boolean;
}

const TIME_ICONS: { [key: string]: string } = {
  Morning: '🌅',
  Afternoon: '☀️',
  Evening: '🌆',
  Night: '🌙',
};

const DAY_BADGE_COLORS: { [key: number]: { bg: string; text: string; border: string; activeBg: string } } = {
  1: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', activeBg: 'bg-blue-600 text-white' },
  2: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', activeBg: 'bg-emerald-600 text-white' },
  3: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', activeBg: 'bg-amber-600 text-white' },
  4: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', activeBg: 'bg-purple-600 text-white' },
  5: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', activeBg: 'bg-rose-600 text-white' },
  6: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', activeBg: 'bg-indigo-600 text-white' },
  7: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', activeBg: 'bg-teal-600 text-white' },
};

export const ItineraryPanel: React.FC<ItineraryPanelProps> = ({
  room,
  onGenerateItinerary,
  isGenerating = false,
}) => {
  const [viewMode, setViewMode] = useState<'map' | 'timeline'>('map');
  const [activeDayNumber, setActiveDayNumber] = useState<number>(1);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [showExportSection, setShowExportSection] = useState<boolean>(false);

  const itinerary = room.itinerary;
  const destinationCoords = room.coordinates || { lat: 35.0116, lng: 135.7681 };

  // Determine top/winning date range name
  const topDateCandidate =
    room.dateCandidates.length > 0
      ? [...room.dateCandidates].sort((a, b) => {
          const aVotes = Object.values(a.votes || {}).filter(Boolean).length;
          const bVotes = Object.values(b.votes || {}).filter(Boolean).length;
          if (bVotes !== aVotes) return bVotes - aVotes;
          return b.freeCount - a.freeCount;
        })[0]
      : null;

  const dateRangeLabel = topDateCandidate
    ? `${topDateCandidate.startDate} → ${topDateCandidate.endDate} (${topDateCandidate.nights} nights)`
    : `${room.dateWindowStart} → ${room.dateWindowEnd} (${room.tripLengthNights} nights)`;

  const totalDays = itinerary?.days.length || 0;
  const totalStopsCount = itinerary?.days.reduce((acc, d) => acc + (d.stops?.length || 0), 0) || 0;

  // Active day object for map view
  const currentDayData = useMemo(() => {
    if (!itinerary?.days || itinerary.days.length === 0) return null;
    return itinerary.days.find((d) => d.dayNumber === activeDayNumber) || itinerary.days[0];
  }, [itinerary, activeDayNumber]);

  // Navigate between days
  const handlePrevDay = () => {
    if (activeDayNumber > 1) {
      setActiveDayNumber(activeDayNumber - 1);
      setSelectedStopId(null);
    }
  };

  const handleNextDay = () => {
    if (activeDayNumber < totalDays) {
      setActiveDayNumber(activeDayNumber + 1);
      setSelectedStopId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-xl border border-[#e8e6df] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 tracking-tight">
              Group Trip Itinerary & Map
            </h2>
            {itinerary && (
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ● {totalStopsCount} Locations Pinned
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Geographically sequenced for <span className="font-semibold text-gray-700">{room.destination}</span> • {dateRangeLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle: Day Map View vs Timeline List View */}
          {itinerary && (
            <div className="flex items-center bg-[#f4f2ec] p-0.5 rounded-lg border border-[#e4e1d7]">
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'map'
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Map className="w-3.5 h-3.5 text-blue-600" />
                <span>Day Map View</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'timeline'
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="w-3.5 h-3.5 text-emerald-600" />
                <span>All Days Timeline</span>
              </button>
            </div>
          )}

          {itinerary && (
            <button
              type="button"
              onClick={() => setShowExportSection(!showExportSection)}
              className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-[#e4e1d7] text-gray-800 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-500" />
              <span>{showExportSection ? 'Hide Export' : 'Export & Calendar'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onGenerateItinerary}
            disabled={isGenerating}
            className="px-3.5 py-1.5 bg-[#181d27] hover:bg-black text-white text-xs font-medium rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Synthesizing...' : itinerary ? 'Regenerate' : 'Generate Itinerary'}</span>
          </button>
        </div>
      </div>

      {/* 2. Export Component (Clipboard & Google Calendar Sync) */}
      {itinerary && showExportSection && (
        <Export
          itinerary={itinerary}
          destination={room.destination}
          roomCode={room.code}
          selectedDates={
            topDateCandidate
              ? {
                  startDate: topDateCandidate.startDate,
                  endDate: topDateCandidate.endDate,
                  nights: topDateCandidate.nights,
                }
              : {
                  startDate: room.dateWindowStart,
                  endDate: room.dateWindowEnd,
                  nights: room.tripLengthNights,
                }
          }
          onClose={() => setShowExportSection(false)}
        />
      )}

      {/* 3. Empty State or Itinerary Views */}
      {!itinerary ? (
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#faf9f5] border border-[#f0ede6] text-[#714f14] mx-auto flex items-center justify-center mb-3.5">
            <MapPin className="w-6 h-6 text-[#8c6724]" />
          </div>
          <h3 className="font-bold text-sm text-gray-900 mb-1">
            Build Your Group Itinerary with Pinned Locations Map
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mb-5 leading-relaxed">
            Generate an AI-powered, geographically sequenced schedule for {room.destination}. Every morning,
            afternoon, and evening stop will be pinned to an interactive Leaflet map with walking routes.
          </p>
          <button
            type="button"
            onClick={onGenerateItinerary}
            disabled={isGenerating}
            className="px-4 py-2 bg-[#181d27] hover:bg-black text-white text-xs font-medium rounded-lg shadow-2xs transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isGenerating ? 'Creating with Gemini...' : 'Generate Itinerary with Pinned Map'}</span>
          </button>
        </div>
      ) : viewMode === 'map' ? (
        /* ========================================================================= */
        /* MODE A: DEDICATED DAY MAP VIEW (ALL LOCATIONS FOR THE DAY PINNED ON 1 MAP) */
        /* ========================================================================= */
        <div className="space-y-4">
          {/* Day Selector Bar & Sequence Navigation */}
          <div className="bg-white rounded-xl border border-[#e8e6df] p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider font-mono mr-1">
                  Select Day:
                </span>
                {itinerary.days.map((day) => {
                  const isActive = activeDayNumber === day.dayNumber;
                  const color = DAY_BADGE_COLORS[day.dayNumber] || {
                    bg: 'bg-gray-50',
                    text: 'text-gray-700',
                    border: 'border-gray-200',
                    activeBg: 'bg-gray-900 text-white',
                  };

                  return (
                    <button
                      key={day.dayNumber}
                      type="button"
                      onClick={() => {
                        setActiveDayNumber(day.dayNumber);
                        setSelectedStopId(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                        isActive
                          ? `${color.activeBg} ring-2 ring-black/10`
                          : `${color.bg} ${color.text} border ${color.border} hover:opacity-80`
                      }`}
                    >
                      <span>Day {day.dayNumber}</span>
                      <span className="text-[10px] opacity-75 font-mono">
                        ({day.stops?.length || 0} pins)
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setActiveDayNumber(0); // 0 = All Days Overview
                    setSelectedStopId(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeDayNumber === 0
                      ? 'bg-[#181d27] text-white shadow-2xs'
                      : 'bg-[#faf9f5] hover:bg-gray-100 text-gray-700 border border-[#e4e1d7]'
                  }`}
                >
                  All Days Overview
                </button>
              </div>

              {/* Prev / Next Day Controls */}
              {activeDayNumber > 0 && (
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    disabled={activeDayNumber <= 1}
                    className="p-1.5 rounded-lg border border-[#e4e1d7] bg-white hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title="Previous Day"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold text-gray-800 px-1">
                    {activeDayNumber} / {totalDays}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextDay}
                    disabled={activeDayNumber >= totalDays}
                    className="p-1.5 rounded-lg border border-[#e4e1d7] bg-white hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title="Next Day"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Active Day Banner Details */}
            {currentDayData && activeDayNumber > 0 && (
              <div className="mt-3 pt-3 border-t border-[#f0ede6] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#181d27] text-white text-[11px] font-bold font-mono">
                      Day {currentDayData.dayNumber}
                    </span>
                    <h3 className="font-bold text-sm text-gray-900 tracking-tight">
                      {currentDayData.theme || `Day ${currentDayData.dayNumber} Exploration`}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500">
                    📅 {currentDayData.date} • <strong className="text-emerald-700">All {currentDayData.stops?.length || 0} locations pinned on the map below in sequential order</strong>
                  </p>
                </div>

                {/* Route sequence chips */}
                <div className="flex items-center gap-1.5 text-xs overflow-x-auto py-1">
                  {currentDayData.stops.map((stop, sIdx) => (
                    <button
                      key={stop.id || sIdx}
                      type="button"
                      onClick={() => setSelectedStopId(stop.id)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 flex items-center gap-1 cursor-pointer border ${
                        selectedStopId === stop.id
                          ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold ring-1 ring-amber-300'
                          : 'bg-[#faf9f5] border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="font-mono font-bold">#{sIdx + 1}</span>
                      <span className="truncate max-w-[120px]">{stop.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Side-by-Side: Map + Synchronized Itinerary List */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* The Map Canvas (7 cols on desktop) */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
              <ItineraryMap
                itinerary={itinerary}
                destination={room.destination}
                destinationCoordinates={destinationCoords}
                activeDayFilter={activeDayNumber === 0 ? null : activeDayNumber}
                onDayFilterChange={(day) => setActiveDayNumber(day === null ? 0 : day)}
                selectedStopId={selectedStopId}
                onSelectStop={(stop) => setSelectedStopId(stop.id)}
                height="540px"
              />
            </div>

            {/* Synchronized Itinerary Stops List for the Day (5 cols on desktop) */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col space-y-3">
              <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-4 flex flex-col h-full max-h-[540px]">
                <div className="flex items-center justify-between pb-3 border-b border-[#f0ede6] mb-3">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">
                      {activeDayNumber === 0 ? 'All Stops Schedule' : `Day ${activeDayNumber} Stops (${currentDayData?.stops?.length || 0})`}
                    </h4>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Click stop to focus pin
                  </span>
                </div>

                {/* Scrollable list of stops */}
                <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
                  {(activeDayNumber === 0 ? itinerary.days.flatMap((d) => d.stops) : (currentDayData?.stops || [])).map(
                    (stop, sIdx) => {
                      const isSelected = selectedStopId === stop.id;
                      const timeEmoji = TIME_ICONS[stop.timeOfDay] || '📍';
                      const googleMapsUrl =
                        stop.mapsUri ||
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${stop.title}, ${stop.address || room.destination}`
                        )}`;

                      return (
                        <div
                          key={stop.id || sIdx}
                          onClick={() => setSelectedStopId(stop.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-200/70 shadow-xs'
                              : 'bg-[#faf9f5] border-[#e8e6df] hover:border-gray-300 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              {/* Pin Number Badge */}
                              <div
                                className={`w-6 h-6 rounded-md font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs ${
                                  isSelected
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-[#181d27] text-white'
                                }`}
                              >
                                #{sIdx + 1}
                              </div>

                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                                  <span>{timeEmoji}</span>
                                  <span>{stop.timeOfDay}</span>
                                </span>
                                <h5 className="font-bold text-xs text-gray-900 leading-snug">
                                  {stop.title}
                                </h5>
                              </div>
                            </div>

                            <a
                              href={googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Open in Google Maps"
                              className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed pl-8">
                            {stop.description}
                          </p>

                          {stop.address && (
                            <div className="text-[10px] text-gray-400 mt-1.5 pl-8 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                              <span className="truncate">{stop.address}</span>
                            </div>
                          )}

                          {isSelected && (
                            <div className="mt-2 pt-2 border-t border-amber-200/60 pl-8 flex items-center justify-between text-[10px]">
                              <span className="font-bold text-amber-900 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-amber-600" />
                                Focused on Map
                              </span>
                              <span className="font-mono text-amber-700">Pin #{sIdx + 1}</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE B: ALL DAYS TIMELINE DOCUMENT VIEW (WITH MAP ACTION ON EACH DAY)   */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Summary Card */}
          <div className="bg-[#faf9f5] border border-[#e8e6df] rounded-xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">
                {itinerary.title || `${room.destination} Group Expedition`}
              </h3>
              <p className="text-xs text-gray-600 mt-1 max-w-2xl leading-relaxed">
                {itinerary.summary}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className="px-3.5 py-2 bg-[#181d27] hover:bg-black text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Map className="w-3.5 h-3.5 text-amber-400" />
              <span>Switch to Day Map View</span>
            </button>
          </div>

          {/* Days Stack */}
          <div className="space-y-4">
            {itinerary.days.map((day) => {
              const badgeStyle = DAY_BADGE_COLORS[day.dayNumber] || {
                bg: 'bg-gray-100',
                text: 'text-gray-800',
                border: 'border-gray-200',
              };

              return (
                <div
                  key={day.dayNumber}
                  className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs overflow-hidden"
                >
                  {/* Day Header Banner */}
                  <div className="px-5 py-3.5 bg-[#fbfbfa] border-b border-[#f0ede6] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-md border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                        Day {day.dayNumber}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">
                          {day.theme || `Day ${day.dayNumber} Exploration`}
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          {day.date} • {day.stops?.length || 0} scheduled locations
                        </p>
                      </div>
                    </div>

                    {/* Button to open this exact day on the map */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDayNumber(day.dayNumber);
                        setViewMode('map');
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span>View All {day.stops?.length || 0} Locations on Map</span>
                      <ChevronRight className="w-3 h-3 text-blue-500" />
                    </button>
                  </div>

                  {/* Day Stops Timeline List */}
                  <div className="p-4 sm:p-5 divide-y divide-gray-100">
                    {day.stops.map((stop, stopIdx) => {
                      const timeEmoji = TIME_ICONS[stop.timeOfDay] || '📍';
                      const googleMapsUrl =
                        stop.mapsUri ||
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${stop.title}, ${stop.address || room.destination}`
                        )}`;

                      return (
                        <div
                          key={stop.id || stopIdx}
                          className="py-3.5 first:pt-0 last:pb-0 hover:bg-gray-50/70 rounded-lg px-2 -mx-2 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {/* Sequence Badge matching Map pin */}
                              <div className="w-7 h-7 rounded-lg bg-[#181d27] text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                                #{stopIdx + 1}
                              </div>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                    <span>{timeEmoji}</span>
                                    <span>{stop.timeOfDay}</span>
                                  </span>
                                  <span className="text-gray-300">•</span>
                                  <h5 className="font-bold text-xs text-gray-900">
                                    {stop.title}
                                  </h5>
                                </div>

                                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                  {stop.description}
                                </p>

                                {stop.address && (
                                  <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1.5">
                                    <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                                    <span>{stop.address}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDayNumber(day.dayNumber);
                                  setSelectedStopId(stop.id);
                                  setViewMode('map');
                                }}
                                className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-[11px] font-medium rounded-md shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Map className="w-3 h-3 text-gray-500" />
                                <span>Pin #{stopIdx + 1}</span>
                              </button>

                              <a
                                href={googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Open in Google Maps"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
