import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { ExternalLink, Compass } from 'lucide-react';

interface OpenStreetMapPreviewProps {
  lat: number;
  lng: number;
  destinationName?: string;
  zoom?: number;
  interactive?: boolean;
  onCoordinatesChange?: (coords: { lat: number; lng: number }) => void;
  height?: string;
}

export const OpenStreetMapPreview: React.FC<OpenStreetMapPreviewProps> = ({
  lat,
  lng,
  destinationName,
  zoom = 12,
  interactive = true,
  onCoordinatesChange,
  height = '180px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Custom SVG Pin icon that doesn't rely on Leaflet's default image files
    const customPinIcon = L.divIcon({
      className: 'custom-osm-pin',
      html: `
        <div style="
          position: relative;
          width: 32px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
          transform: translate(-16px, -40px);
        ">
          <svg viewBox="0 0 24 32" width="32" height="40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.372 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="#181d27"/>
            <circle cx="12" cy="11" r="5" fill="#f59e0b"/>
            <circle cx="12" cy="11" r="2.5" fill="#ffffff"/>
          </svg>
        </div>
      `,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      popupAnchor: [0, -36],
    });

    // Initialize Map
    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom,
      zoomControl: interactive,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    // OpenStreetMap tile layer (standard free & open raster tiles)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Attribution
    L.control
      .attribution({
        prefix: false,
        position: 'bottomright',
      })
      .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a>')
      .addTo(map);

    // Initial marker
    const marker = L.marker([lat, lng], {
      icon: customPinIcon,
      draggable: Boolean(onCoordinatesChange && interactive),
    }).addTo(map);

    if (destinationName) {
      marker.bindPopup(`<b>${destinationName}</b><br/><span style="font-size:11px;color:#666;">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>`);
    }

    if (onCoordinatesChange && interactive) {
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onCoordinatesChange({ lat: pos.lat, lng: pos.lng });
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onCoordinatesChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    mapInstanceRef.current = map;
    markerRef.current = marker;

    // Invalidate size once rendered in DOM
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update map center & marker when coordinates change
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;

    const currentCenter = mapInstanceRef.current.getCenter();
    const dist = Math.hypot(currentCenter.lat - lat, currentCenter.lng - lng);

    if (dist > 0.0001) {
      mapInstanceRef.current.flyTo([lat, lng], zoom, {
        duration: 0.8,
      });
      markerRef.current.setLatLng([lat, lng]);

      if (destinationName) {
        markerRef.current
          .setPopupContent(`<b>${destinationName}</b><br/><span style="font-size:11px;color:#666;">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>`);
      }
    }
  }, [lat, lng, zoom, destinationName]);

  const osmExternalUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`;

  return (
    <div className="relative rounded-lg overflow-hidden border border-[#e4e1d7] shadow-2xs group">
      <div ref={containerRef} style={{ height, width: '100%' }} className="bg-[#f0ede6]" />

      {/* Top overlay badges */}
      <div className="absolute top-2 left-2 z-[1000] flex items-center gap-1.5 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-medium text-gray-800 border border-[#e4e1d7] shadow-2xs pointer-events-none">
        <Compass className="w-3.5 h-3.5 text-amber-600 animate-spin-slow" />
        <span className="truncate max-w-[160px] sm:max-w-[220px]">
          {destinationName || `${lat.toFixed(3)}, ${lng.toFixed(3)}`}
        </span>
      </div>

      {/* Link to OpenStreetMap */}
      <a
        href={osmExternalUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in OpenStreetMap"
        className="absolute top-2 right-2 z-[1000] p-1.5 bg-white/90 hover:bg-white text-gray-700 hover:text-black rounded-md border border-[#e4e1d7] shadow-2xs transition-colors cursor-pointer"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>

      {/* Interactive notice footer */}
      {interactive && onCoordinatesChange && (
        <div className="absolute bottom-1 left-2 z-[1000] pointer-events-none text-[10px] text-gray-600 bg-white/80 px-2 py-0.5 rounded-sm backdrop-blur-2xs">
          Click or drag pin to adjust center
        </div>
      )}
    </div>
  );
};
