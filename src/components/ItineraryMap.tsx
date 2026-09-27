import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  ExternalLink,
  Layers,
  Calendar,
  Clock,
  Navigation,
  Compass,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { Itinerary, ItineraryStop } from '../types/index.ts';

// Day color palette matching Scalar Field / Splitroom aesthetic
const DAY_COLORS: { [key: number]: { bg: string; border: string; text: string; hex: string } } = {
  1: { bg: 'bg-blue-600', border: 'border-blue-700', text: 'text-white', hex: '#2563eb' },
  2: { bg: 'bg-emerald-600', border: 'border-emerald-700', text: 'text-white', hex: '#059669' },
  3: { bg: 'bg-amber-600', border: 'border-amber-700', text: 'text-white', hex: '#d97706' },
  4: { bg: 'bg-purple-600', border: 'border-purple-700', text: 'text-white', hex: '#7c3aed' },
  5: { bg: 'bg-rose-600', border: 'border-rose-700', text: 'text-white', hex: '#e11d48' },
  6: { bg: 'bg-indigo-600', border: 'border-indigo-700', text: 'text-white', hex: '#4f46e5' },
  7: { bg: 'bg-teal-600', border: 'border-teal-700', text: 'text-white', hex: '#0d9488' },
};

function getDayColor(dayNumber: number) {
  return DAY_COLORS[dayNumber] || {
    bg: 'bg-gray-800',
    border: 'border-gray-900',
    text: 'text-white',
    hex: '#1f2937',
  };
}

export interface PinnedItineraryStop extends ItineraryStop {
  dayNumber: number;
  dayTheme?: string;
  stopIndex: number;
  lat: number;
  lng: number;
}

export interface ItineraryMapProps {
  itinerary: Itinerary | null;
  destination: string;
  destinationCoordinates?: { lat: number; lng: number };
  activeDayFilter?: number | null; // null = all days
  onDayFilterChange?: (dayNumber: number | null) => void;
  selectedStopId?: string | null;
  onSelectStop?: (stop: ItineraryStop) => void;
  height?: string;
  className?: string;
}

export const ItineraryMap: React.FC<ItineraryMapProps> = ({
  itinerary,
  destination,
  destinationCoordinates = { lat: 35.0116, lng: 135.7681 },
  activeDayFilter = null,
  onDayFilterChange,
  selectedStopId,
  onSelectStop,
  height = '480px',
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineLayerRef = useRef<L.LayerGroup | null>(null);
  const [internalDayFilter, setInternalDayFilter] = useState<number | null>(activeDayFilter);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync internal filter if prop changes
  useEffect(() => {
    setInternalDayFilter(activeDayFilter);
  }, [activeDayFilter]);

  const handleFilterClick = (dayNumber: number | null) => {
    setInternalDayFilter(dayNumber);
    onDayFilterChange?.(dayNumber);
  };

  // 1. Extract and compute pinned stops with guaranteed coordinates
  const allPinnedStops: PinnedItineraryStop[] = useMemo(() => {
    if (!itinerary?.days) return [];

    const centerLat = destinationCoordinates.lat;
    const centerLng = destinationCoordinates.lng;
    const result: PinnedItineraryStop[] = [];

    itinerary.days.forEach((day) => {
      day.stops.forEach((stop, stopIdx) => {
        let lat = stop.coordinates?.lat;
        let lng = stop.coordinates?.lng;

        // If coordinates missing, generate realistic local offset around destination center
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
          // Deterministic offset based on day, stop index, and stop id hash
          const hash = Array.from(stop.title || stop.id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const angle = ((day.dayNumber * 3 + stopIdx) * 55 + (hash % 40)) * (Math.PI / 180);
          const radiusKm = 0.6 + ((hash % 15) / 10); // 0.6km - 2.1km from center
          // 1 deg lat ~ 111km, 1 deg lng ~ 111km * cos(lat)
          const latOffset = (radiusKm * Math.cos(angle)) / 111;
          const lngOffset = (radiusKm * Math.sin(angle)) / (111 * Math.cos((centerLat * Math.PI) / 180));

          lat = centerLat + latOffset;
          lng = centerLng + lngOffset;
        }

        result.push({
          ...stop,
          dayNumber: day.dayNumber,
          dayTheme: day.theme,
          stopIndex: stopIdx + 1,
          lat,
          lng,
        });
      });
    });

    return result;
  }, [itinerary, destinationCoordinates]);

  // Filter stops based on selected day
  const displayedStops = useMemo(() => {
    if (internalDayFilter === null) return allPinnedStops;
    return allPinnedStops.filter((s) => s.dayNumber === internalDayFilter);
  }, [allPinnedStops, internalDayFilter]);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [destinationCoordinates.lat, destinationCoordinates.lng],
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
      });

      // Standard OpenStreetMap raster tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Attribution
      L.control
        .attribution({
          prefix: false,
          position: 'bottomright',
        })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a>')
        .addTo(map);

      // Layer groups for markers and routes
      markersLayerRef.current = L.layerGroup().addTo(map);
      polylineLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        polylineLayerRef.current = null;
      }
    };
  }, []);

  // Invalidate map size on height/fullscreen changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [height, isFullscreen]);

  // 3. Render Pinned Locations & Route Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const polylineLayer = polylineLayerRef.current;
    if (!map || !markersLayer || !polylineLayer) return;

    markersLayer.clearLayers();
    polylineLayer.clearLayers();

    // If no stops, place a single anchor pin for destination
    if (displayedStops.length === 0) {
      const destinationIcon = L.divIcon({
        className: 'dest-center-pin',
        html: `
          <div style="
            position: relative;
            width: 36px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
            transform: translate(-18px, -44px);
          ">
            <svg viewBox="0 0 24 32" width="36" height="44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.372 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="#181d27"/>
              <circle cx="12" cy="11" r="5" fill="#f59e0b"/>
              <circle cx="12" cy="11" r="2.5" fill="#ffffff"/>
            </svg>
          </div>
        `,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -40],
      });

      const destMarker = L.marker([destinationCoordinates.lat, destinationCoordinates.lng], {
        icon: destinationIcon,
      }).addTo(markersLayer);

      destMarker.bindPopup(`
        <div style="font-family: inherit; padding: 4px;">
          <h4 style="font-weight: 700; font-size: 13px; margin: 0 0 4px 0; color: #111;">${destination}</h4>
          <p style="font-size: 11px; color: #666; margin: 0;">Itinerary map ready. Generate an itinerary to view pinned stops.</p>
        </div>
      `);

      map.setView([destinationCoordinates.lat, destinationCoordinates.lng], 13);
      return;
    }

    const bounds = L.latLngBounds([]);

    // Group stops by day to draw sequential route polylines
    const stopsByDay: { [key: number]: PinnedItineraryStop[] } = {};
    displayedStops.forEach((stop) => {
      if (!stopsByDay[stop.dayNumber]) stopsByDay[stop.dayNumber] = [];
      stopsByDay[stop.dayNumber].push(stop);
    });

    // Draw Polylines for each day
    Object.entries(stopsByDay).forEach(([dayNumStr, dayStops]) => {
      const dayNum = parseInt(dayNumStr, 10);
      const color = getDayColor(dayNum);
      const latLngs = dayStops.map((s) => [s.lat, s.lng] as [number, number]);

      if (latLngs.length > 1) {
        L.polyline(latLngs, {
          color: color.hex,
          weight: 3.5,
          opacity: 0.75,
          dashArray: '6, 8',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(polylineLayer);
      }
    });

    // Place Markers for each stop
    displayedStops.forEach((stop) => {
      bounds.extend([stop.lat, stop.lng]);
      const color = getDayColor(stop.dayNumber);
      const isSelected = selectedStopId === stop.id;

      // Custom HTML Pin Icon
      const pinIcon = L.divIcon({
        className: 'itinerary-pin',
        html: `
          <div style="
            position: relative;
            transform: translate(-18px, -42px);
            cursor: pointer;
          ">
            <div style="
              width: 38px;
              height: 44px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              filter: drop-shadow(0 4px 10px rgba(0,0,0,0.38));
              transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
              ${isSelected ? 'transform: scale(1.25);' : ''}
            ">
              <svg viewBox="0 0 28 36" width="38" height="44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.732-6.268-14-14-14z" fill="${color.hex}"/>
                <circle cx="14" cy="14" r="11" fill="#ffffff" />
              </svg>
              <div style="
                position: absolute;
                top: 5px;
                left: 0;
                right: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                pointer-events: none;
              ">
                <span style="
                  font-size: ${internalDayFilter !== null ? '14px' : '10px'};
                  font-weight: 900;
                  font-family: ui-monospace, monospace;
                  color: ${color.hex};
                  line-height: 1;
                ">
                  ${internalDayFilter !== null ? stop.stopIndex : `D${stop.dayNumber}`}
                </span>
                ${
                  internalDayFilter === null
                    ? `
                <span style="
                  font-size: 8px;
                  font-weight: 700;
                  color: #4b5563;
                  line-height: 1;
                  margin-top: 1px;
                ">
                  #${stop.stopIndex}
                </span>`
                    : ''
                }
              </div>
            </div>
            ${
              isSelected
                ? `
              <div style="
                position: absolute;
                top: -2px;
                left: -2px;
                width: 42px;
                height: 42px;
                border-radius: 50%;
                border: 3px solid #f59e0b;
                box-shadow: 0 0 14px rgba(245, 158, 11, 0.9);
                animation: pulse 1.5s infinite;
              "></div>
            `
                : ''
            }
          </div>
        `,
        iconSize: [38, 44],
        iconAnchor: [19, 44],
        popupAnchor: [0, -42],
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: pinIcon }).addTo(markersLayer);

      // Popup Content
      const googleMapsQuery = stop.mapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${stop.title}, ${stop.address || destination}`
      )}`;

      const popupHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2px; max-width: 260px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              padding: 2px 6px;
              border-radius: 4px;
              background-color: ${color.hex}15;
              color: ${color.hex};
              border: 1px solid ${color.hex}30;
            ">
              Day ${stop.dayNumber} • ${stop.timeOfDay}
            </span>
            <span style="font-size: 11px; font-weight: 600; color: #6b7280; font-family: monospace;">
              Stop #${stop.stopIndex}
            </span>
          </div>

          <h4 style="font-size: 13px; font-weight: 700; margin: 0 0 4px 0; color: #111827; line-height: 1.3;">
            ${stop.title}
          </h4>

          <p style="font-size: 11px; color: #4b5563; margin: 0 0 8px 0; line-height: 1.4;">
            ${stop.description}
          </p>

          ${stop.address ? `
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 8px; display: flex; align-items: flex-start; gap: 4px;">
              <span style="font-weight: 600; color: #374151;">📍</span>
              <span>${stop.address}</span>
            </div>
          ` : ''}

          <div style="border-top: 1px solid #f3f4f6; padding-top: 6px; display: flex; align-items: center; justify-content: space-between;">
            <a href="${googleMapsQuery}" target="_blank" rel="noopener noreferrer" style="
              font-size: 11px;
              font-weight: 600;
              color: #2563eb;
              text-decoration: none;
              display: inline-flex;
              align-items: center;
              gap: 3px;
            ">
              <span>View in Google Maps</span>
              <span style="font-size: 10px;">↗</span>
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        onSelectStop?.(stop);
      });

      // If this stop is selected, open popup automatically
      if (isSelected) {
        marker.openPopup();
      }
    });

    if (displayedStops.length > 0) {
      map.fitBounds(bounds, {
        padding: [45, 45],
        maxZoom: 15,
      });
    }
  }, [displayedStops, destinationCoordinates, selectedStopId, destination]);

  // Smoothly pan to selected stop when clicked from the itinerary list
  useEffect(() => {
    if (!selectedStopId || !mapInstanceRef.current) return;
    const targetStop = displayedStops.find((s) => s.id === selectedStopId);
    if (targetStop) {
      mapInstanceRef.current.flyTo([targetStop.lat, targetStop.lng], 15, {
        animate: true,
        duration: 0.7,
      });
    }
  }, [selectedStopId, displayedStops]);

  // Recenter map button handler
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    if (displayedStops.length > 0) {
      const bounds = L.latLngBounds(displayedStops.map((s) => [s.lat, s.lng]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
    } else {
      mapInstanceRef.current.setView([destinationCoordinates.lat, destinationCoordinates.lng], 13);
    }
  };

  const daysList = useMemo(() => {
    if (!itinerary?.days) return [];
    return itinerary.days.map((d) => d.dayNumber);
  }, [itinerary]);

  return (
    <div
      className={`bg-white rounded-xl border border-[#e8e6df] shadow-2xs overflow-hidden flex flex-col transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl border-gray-400' : ''
      } ${className}`}
    >
      {/* Map Control Header */}
      <div className="px-4 py-3 bg-[#faf9f5] border-b border-[#e8e6df] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#181d27] text-white flex items-center justify-center shadow-2xs">
            <Navigation className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-gray-900 tracking-tight">
                Itinerary Route & Pinned Locations
              </h3>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#f0ede6] text-gray-700 border border-[#e4e1d7]">
                {displayedStops.length} Pins
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Interactive Leaflet map for {destination} with daily sequential pathways
            </p>
          </div>
        </div>

        {/* Filter by Day Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleFilterClick(null)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
              internalDayFilter === null
                ? 'bg-[#181d27] text-white shadow-2xs'
                : 'bg-white hover:bg-gray-100 text-gray-600 border border-[#e4e1d7]'
            }`}
          >
            All Days
          </button>

          {daysList.map((dayNum) => {
            const color = getDayColor(dayNum);
            const isDayActive = internalDayFilter === dayNum;
            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => handleFilterClick(dayNum)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isDayActive
                    ? `${color.bg} text-white shadow-2xs`
                    : 'bg-white hover:bg-gray-100 text-gray-700 border border-[#e4e1d7]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isDayActive ? '#ffffff' : color.hex }}
                />
                <span>Day {dayNum}</span>
              </button>
            );
          })}

          <div className="h-4 w-px bg-[#e4e1d7] mx-1" />

          {/* Recenter & Fullscreen buttons */}
          <button
            type="button"
            onClick={handleRecenter}
            title="Recenter Map"
            className="p-1.5 rounded-md bg-white hover:bg-gray-100 text-gray-600 border border-[#e4e1d7] cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
            className="p-1.5 rounded-md bg-white hover:bg-gray-100 text-gray-600 border border-[#e4e1d7] cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div className="relative flex-1" style={{ height: isFullscreen ? 'calc(100vh - 120px)' : height }}>
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Map Legend */}
        {allPinnedStops.length > 0 && (
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs border border-[#e8e6df] rounded-lg p-2.5 shadow-md text-[11px] max-w-xs pointer-events-auto">
            <div className="flex items-center gap-1.5 font-bold text-gray-900 mb-1.5">
              <Layers className="w-3.5 h-3.5 text-gray-600" />
              <span>Daily Sequence Legend</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {daysList.map((dayNum) => {
                const color = getDayColor(dayNum);
                const dayTheme = itinerary?.days.find((d) => d.dayNumber === dayNum)?.theme;
                return (
                  <div key={dayNum} className="flex items-center gap-1.5 text-gray-600 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
                    <span className="font-semibold text-gray-800">Day {dayNum}:</span>
                    <span className="truncate text-gray-500 text-[10px]">{dayTheme || 'Schedule'}</span>
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
