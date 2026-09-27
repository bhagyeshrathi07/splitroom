import React, { useState } from 'react';
import {
  Copy,
  Check,
  Calendar,
  ExternalLink,
  Download,
  Share2,
  FileText,
  Sparkles,
  MapPin,
  Clock,
  Send,
  X,
} from 'lucide-react';
import type { Itinerary, ItineraryDay, ItineraryStop } from '../types/index.ts';

export interface ExportProps {
  itinerary: Itinerary | null;
  destination: string;
  roomCode?: string;
  selectedDates?: {
    startDate: string;
    endDate: string;
    nights?: number;
  } | null;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

// Helper to format ISO date string (YYYY-MM-DD) into Google Calendar compact date (YYYYMMDD)
function toGoogleCalendarDate(dateStr: string, addDays: number = 0): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr.replace(/-/g, '');
    d.setDate(d.getDate() + addDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  } catch {
    return dateStr.replace(/-/g, '');
  }
}

// Generate formatted plain text / Markdown summary for clipboard
export function generateItineraryTextSummary(
  itinerary: Itinerary,
  destination: string,
  selectedDates?: { startDate: string; endDate: string; nights?: number } | null
): string {
  const firstDayDate = itinerary.days[0]?.date || selectedDates?.startDate || '';
  const lastDayDate = itinerary.days[itinerary.days.length - 1]?.date || selectedDates?.endDate || '';

  const dateHeading = firstDayDate && lastDayDate
    ? `🗓️ Dates: ${firstDayDate} to ${lastDayDate} (${itinerary.days.length} Days)`
    : `🗓️ Duration: ${itinerary.days.length} Days`;

  let text = `✈️ ${itinerary.title || `${destination} Trip Itinerary`}\n`;
  text += `📍 Destination: ${destination}\n`;
  text += `${dateHeading}\n\n`;

  if (itinerary.summary) {
    text += `📖 Overview:\n${itinerary.summary}\n\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `DAILY SCHEDULE\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  itinerary.days.forEach((day: ItineraryDay) => {
    const dayTheme = day.theme ? ` - ${day.theme}` : '';
    text += `📅 DAY ${day.dayNumber} (${day.date})${dayTheme}\n`;
    text += `─────────────────────────────────\n`;

    if (!day.stops || day.stops.length === 0) {
      text += `  • Free exploration day\n\n`;
      return;
    }

    day.stops.forEach((stop: ItineraryStop, idx: number) => {
      const timeTag = stop.timeOfDay ? `[${stop.timeOfDay.toUpperCase()}] ` : '';
      text += `  ${idx + 1}. ${timeTag}${stop.title}\n`;
      if (stop.description) {
        text += `     ${stop.description}\n`;
      }
      if (stop.address) {
        text += `     📍 ${stop.address}\n`;
      }
      if (stop.mapsUri) {
        text += `     🗺️ ${stop.mapsUri}\n`;
      }
      text += `\n`;
    });
  });

  text += `\n✨ Generated collaboratively with Splitroom`;
  return text;
}

// Build Google Calendar Web URL for entire trip or individual days
export function buildGoogleCalendarUrl(
  title: string,
  startDateStr: string,
  endDateStr: string,
  details: string,
  location: string
): string {
  // All day event format: YYYYMMDD/YYYYMMDD (end date is day after for exclusive boundary in GCal)
  const gStart = toGoogleCalendarDate(startDateStr, 0);
  const gEnd = toGoogleCalendarDate(endDateStr, 1);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${gStart}/${gEnd}`,
    details: details.slice(0, 2500), // GCal URL length safety
    location: location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Build .ics calendar file content
export function generateICSContent(
  itinerary: Itinerary,
  destination: string
): string {
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Splitroom//Trip Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  itinerary.days.forEach((day) => {
    const startDateClean = toGoogleCalendarDate(day.date, 0);
    const endDateClean = toGoogleCalendarDate(day.date, 1);
    const dayStopsText = (day.stops || [])
      .map((s, i) => `${i + 1}. [${s.timeOfDay}] ${s.title}: ${s.description}${s.address ? ` (${s.address})` : ''}`)
      .join('\\n');

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:splitroom-${day.dayNumber}-${day.date}-${Date.now()}@splitroom.app`);
    ics.push(`DTSTAMP:${nowStr}`);
    ics.push(`DTSTART;VALUE=DATE:${startDateClean}`);
    ics.push(`DTEND;VALUE=DATE:${endDateClean}`);
    ics.push(`SUMMARY:${itinerary.title || destination}: Day ${day.dayNumber} - ${day.theme || 'Exploration'}`);
    ics.push(`DESCRIPTION:${dayStopsText}`);
    ics.push(`LOCATION:${destination}`);
    ics.push('STATUS:CONFIRMED');
    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

export const Export: React.FC<ExportProps> = ({
  itinerary,
  destination,
  roomCode,
  selectedDates,
  isOpen = true,
  onClose,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<'text' | 'gcal' | 'ics'>('text');

  if (!itinerary) {
    return (
      <div className={`bg-white rounded-xl border border-[#e8e6df] p-6 text-center shadow-2xs ${className}`}>
        <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-gray-900">No Finalized Itinerary to Export</h4>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          Generate an itinerary first from the Itinerary tab to export or add to your Google Calendar.
        </p>
      </div>
    );
  }

  const startDateStr = itinerary.days[0]?.date || selectedDates?.startDate || new Date().toISOString().split('T')[0];
  const endDateStr = itinerary.days[itinerary.days.length - 1]?.date || selectedDates?.endDate || startDateStr;

  const textSummary = generateItineraryTextSummary(itinerary, destination, selectedDates);

  // Copy to clipboard handler
  const handleCopyClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textSummary);
      } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = textSummary;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Google Calendar Trip URL
  const gcalTripUrl = buildGoogleCalendarUrl(
    `✈️ ${itinerary.title || `${destination} Trip`}`,
    startDateStr,
    endDateStr,
    textSummary,
    destination
  );

  // Trigger Add to Google Calendar Action
  const handleAddToGoogleCalendar = () => {
    window.open(gcalTripUrl, '_blank', 'noopener,noreferrer');
  };

  // Download .ics File
  const handleDownloadICS = () => {
    const icsData = generateICSContent(itinerary, destination);
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${destination.replace(/[^a-zA-Z0-9]/g, '_')}_Itinerary.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`bg-white rounded-xl border border-[#e8e6df] shadow-2xs overflow-hidden flex flex-col ${className}`}>
      {/* Component Header */}
      <div className="px-5 py-4 bg-[#faf9f5] border-b border-[#e8e6df] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#181d27] text-white flex items-center justify-center shadow-2xs">
            <Share2 className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-900 tracking-tight">
              Export Itinerary & Calendar Sync
            </h3>
            <p className="text-[11px] text-gray-500">
              Share formatted trip notes with friends or sync schedule to Google Calendar
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-200 text-gray-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Action Bar */}
      <div className="p-5 space-y-4">
        {/* Quick-action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Primary Action 1: Copy to Clipboard */}
          <button
            type="button"
            onClick={handleCopyClipboard}
            className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-300'
                : 'bg-[#181d27] hover:bg-black text-white border-[#181d27]'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Copy Formatted Summary</span>
              </>
            )}
          </button>

          {/* Primary Action 2: Add to Google Calendar */}
          <button
            type="button"
            onClick={handleAddToGoogleCalendar}
            className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Add to Google Calendar</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-500 ml-0.5" />
          </button>
        </div>

        {/* Secondary Options: Format Switcher */}
        <div className="flex items-center justify-between border-b border-[#f0ede6] pb-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-700 text-[11px] uppercase tracking-wider font-mono">
              Export View:
            </span>
            <button
              type="button"
              onClick={() => setExportFormat('text')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                exportFormat === 'text'
                  ? 'bg-[#181d27] text-white shadow-2xs'
                  : 'bg-[#f4f2ec] hover:bg-gray-200 text-gray-700'
              }`}
            >
              Text Preview
            </button>
            <button
              type="button"
              onClick={() => setExportFormat('gcal')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                exportFormat === 'gcal'
                  ? 'bg-[#181d27] text-white shadow-2xs'
                  : 'bg-[#f4f2ec] hover:bg-gray-200 text-gray-700'
              }`}
            >
              Daily Calendar Links
            </button>
          </div>

          {/* iCal .ics download button */}
          <button
            type="button"
            onClick={handleDownloadICS}
            title="Download standard .ics file for Apple Calendar or Outlook"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-gray-900 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Download .ICS File</span>
          </button>
        </div>

        {/* 1. Text Summary Preview Mode */}
        {exportFormat === 'text' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span className="font-medium">
                Ready to paste into WhatsApp, iMessage, Slack, or Email:
              </span>
              <span className="font-mono text-gray-400">
                {textSummary.length} characters
              </span>
            </div>
            <div className="relative">
              <pre className="bg-[#fbfbfa] border border-[#e8e6df] rounded-xl p-3.5 text-[11px] font-mono text-gray-800 max-h-56 overflow-y-auto leading-relaxed whitespace-pre-wrap select-all">
                {textSummary}
              </pre>
            </div>
          </div>
        )}

        {/* 2. Daily Google Calendar Events List */}
        {exportFormat === 'gcal' && (
          <div className="space-y-2">
            <p className="text-[11px] text-gray-500 mb-2">
              Add individual days directly to Google Calendar with detailed stops and addresses:
            </p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {itinerary.days.map((day) => {
                const dayDetails = (day.stops || [])
                  .map((s, idx) => `${idx + 1}. [${s.timeOfDay}] ${s.title}\n${s.description}\n📍 ${s.address || destination}\n`)
                  .join('\n');

                const dayGcalUrl = buildGoogleCalendarUrl(
                  `${itinerary.title || destination} - Day ${day.dayNumber}: ${day.theme || 'Sightseeing'}`,
                  day.date,
                  day.date,
                  dayDetails,
                  destination
                );

                return (
                  <div
                    key={day.dayNumber}
                    className="flex items-center justify-between p-2.5 bg-[#fbfbfa] border border-[#e8e6df] rounded-lg text-xs"
                  >
                    <div>
                      <span className="font-bold text-gray-900">
                        Day {day.dayNumber}: {day.theme || 'Day Schedule'}
                      </span>
                      <p className="text-[11px] text-gray-500">{day.date} • {day.stops?.length || 0} stops</p>
                    </div>

                    <a
                      href={dayGcalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold rounded-md shadow-2xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Calendar className="w-3 h-3 text-blue-600" />
                      <span>Add Day {day.dayNumber}</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
