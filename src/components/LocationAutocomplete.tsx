import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, X, Check, Globe, Sparkles } from 'lucide-react';
import type { PlaceSuggestion } from '../types/index.ts';

interface LocationAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelectPlace: (place: {
    destination: string;
    coordinates?: { lat: number; lng: number };
    countryCode?: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
}

const POPULAR_DESTINATIONS = [
  { name: 'Kyoto, Japan', lat: 35.0116, lng: 135.7681, icon: '⛩️' },
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, icon: '🌸' },
  { name: 'Barcelona, Spain', lat: 41.3879, lng: 2.16992, icon: '☀️' },
  { name: 'Lisbon, Portugal', lat: 38.7223, lng: -9.1393, icon: '🍷' },
  { name: 'New York, USA', lat: 40.7128, lng: -74.006, icon: '🗽' },
  { name: 'Bali, Indonesia', lat: -8.3405, lng: 115.092, icon: '🌴' },
  { name: 'Paris, France', lat: 48.8566, lng: 2.3522, icon: '🗼' },
];

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  onSelectPlace,
  placeholder = 'Search destination (e.g. Kyoto, Lisbon, Bali)',
  disabled = false,
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Sync internal query if external value changes (e.g. reset)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Fetch suggestions with debouncing
  const fetchSuggestions = useCallback(async (text: string) => {
    const clean = text.trim();
    if (clean.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(clean)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (err) {
      console.warn('Place autocomplete fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(val);
      }, 250);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (s: PlaceSuggestion) => {
    setQuery(s.fullText);
    onChange(s.fullText);
    onSelectPlace({
      destination: s.fullText,
      coordinates: { lat: s.lat, lng: s.lng },
      countryCode: s.countryCode,
    });
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleSelectPopular = (p: (typeof POPULAR_DESTINATIONS)[0]) => {
    setQuery(p.name);
    onChange(p.name);
    onSelectPlace({
      destination: p.name,
      coordinates: { lat: p.lat, lng: p.lng },
    });
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Box */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
          <MapPin className="w-4 h-4 text-gray-500" />
        </div>

        <input
          type="text"
          required
          disabled={disabled}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-10 pr-16 py-2 text-xs bg-[#faf9f5] border border-[#e4e1d7] rounded-lg focus:bg-white focus:outline-hidden focus:border-[#181d27] transition-all"
        />

        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          {isLoading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin mr-1" />}

          {query && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              title="Clear input"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          <div
            title="Powered by OpenStreetMap (Free, open-source maps)"
            className="flex items-center text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-medium"
          >
            OSM
          </div>
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-[#e4e1d7] rounded-lg shadow-lg overflow-hidden animate-in fade-in duration-100">
          <div className="p-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-[#faf9f5] flex items-center justify-between">
            <span>OpenStreetMap Locations</span>
            <span className="font-mono text-[9px] text-gray-500 lowercase">open & free</span>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {suggestions.map((s, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={s.id || idx}
                  type="button"
                  onClick={() => handleSelect(s)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#f4f2ec] text-[#181d27]' : 'hover:bg-[#faf9f5] text-gray-800'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-900 truncate">{s.name}</span>
                      {s.countryCode && (
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-gray-100 text-gray-600 rounded">
                          {s.countryCode}
                        </span>
                      )}
                    </div>
                    {s.secondaryText && (
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{s.secondaryText}</p>
                    )}
                  </div>
                  <div className="text-[9px] text-gray-400 font-mono shrink-0 self-center">
                    {s.lat.toFixed(2)}, {s.lng.toFixed(2)}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 py-1.5 bg-[#faf9f5] border-t border-gray-100 text-[10px] text-gray-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-emerald-600" />
              <span>Free OpenStreetMap tiles & geocoding</span>
            </span>
            <span className="font-mono text-[9px]">Use ↑↓ Enter</span>
          </div>
        </div>
      )}

      {/* Quick Picks for Instant Testing */}
      {!value && !isOpen && (
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mr-0.5">
            <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Quick:
          </span>
          {POPULAR_DESTINATIONS.slice(0, 5).map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => handleSelectPopular(p)}
              className="text-[10px] px-2 py-0.5 bg-[#faf9f5] hover:bg-[#f0ede6] text-gray-600 hover:text-black border border-[#e4e1d7] rounded-md transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>{p.icon}</span>
              <span>{p.name.split(',')[0]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
