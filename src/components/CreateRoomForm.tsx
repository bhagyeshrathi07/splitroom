import React, { useState } from 'react';
import { Moon, Calendar, ArrowRight, Loader2, MapPin, Eye, EyeOff } from 'lucide-react';
import { LocationAutocomplete } from './LocationAutocomplete';
import { OpenStreetMapPreview } from './OpenStreetMapPreview';

interface CreateRoomFormProps {
  user: any;
  onRequireAuth: () => void;
  onCreateRoom: (params: {
    destination: string;
    coordinates?: { lat: number; lng: number };
    tripLengthNights: number;
    dateWindowStart: string;
    dateWindowEnd: string;
  }) => Promise<void>;
  loading?: boolean;
}

export const CreateRoomForm: React.FC<CreateRoomFormProps> = ({
  user,
  onRequireAuth,
  onCreateRoom,
  loading = false,
}) => {
  const today = new Date();
  const defaultStart = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const defaultEnd = new Date(today.getTime() + 75 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [destination, setDestination] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | undefined>(
    undefined
  );
  const [showMapPreview, setShowMapPreview] = useState(true);
  const [tripLengthNights, setTripLengthNights] = useState<number>(3);
  const [dateWindowStart, setDateWindowStart] = useState(defaultStart);
  const [dateWindowEnd, setDateWindowEnd] = useState(defaultEnd);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handlePlaceSelect = (place: {
    destination: string;
    coordinates?: { lat: number; lng: number };
  }) => {
    setDestination(place.destination);
    if (place.coordinates) {
      setCoordinates(place.coordinates);
      setShowMapPreview(true);
    }
  };

  const handleMapCoordinatesChange = async (coords: { lat: number; lng: number }) => {
    setCoordinates(coords);
    try {
      const res = await fetch(`/api/places/reverse?lat=${coords.lat}&lng=${coords.lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.destination) {
          setDestination(data.destination);
        }
      }
    } catch {
      // Non-fatal if reverse geocode fails
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!user) {
      onRequireAuth();
      return;
    }

    if (!destination.trim()) {
      setValidationError('Please select or specify a destination city.');
      return;
    }

    if (tripLengthNights < 1 || tripLengthNights > 30) {
      setValidationError('Trip length must be between 1 and 30 nights.');
      return;
    }

    if (!dateWindowStart || !dateWindowEnd) {
      setValidationError('Please specify both start and end dates.');
      return;
    }

    const start = new Date(dateWindowStart);
    const end = new Date(dateWindowEnd);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < tripLengthNights) {
      setValidationError(`Date window must span at least ${tripLengthNights} nights.`);
      return;
    }

    await onCreateRoom({
      destination: destination.trim(),
      coordinates,
      tripLengthNights,
      dateWindowStart,
      dateWindowEnd,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {validationError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {validationError}
        </div>
      )}

      {/* Destination with OpenStreetMap Autocomplete */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Destination Location
          </label>
          {coordinates && (
            <button
              type="button"
              onClick={() => setShowMapPreview((prev) => !prev)}
              className="text-[10px] text-gray-500 hover:text-black flex items-center gap-1 cursor-pointer font-medium"
            >
              {showMapPreview ? (
                <>
                  <EyeOff className="w-3 h-3" /> Hide Map
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3" /> View Map
                </>
              )}
            </button>
          )}
        </div>

        <LocationAutocomplete
          value={destination}
          onChange={setDestination}
          onSelectPlace={handlePlaceSelect}
          placeholder="Search city, island, or region (e.g. Kyoto, Japan)"
        />

        {/* Live OpenStreetMap Preview */}
        {coordinates && showMapPreview && (
          <div className="mt-2.5">
            <OpenStreetMapPreview
              lat={coordinates.lat}
              lng={coordinates.lng}
              destinationName={destination}
              onCoordinatesChange={handleMapCoordinatesChange}
              height="160px"
            />
          </div>
        )}
      </div>

      {/* Trip Length */}
      <div>
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          Trip Length (Nights)
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Moon className="w-4 h-4 text-gray-500" />
            </div>
            <input
              type="number"
              min={1}
              max={30}
              required
              value={tripLengthNights}
              onChange={(e) => setTripLengthNights(parseInt(e.target.value) || 1)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-[#faf9f5] border border-[#e4e1d7] rounded-lg focus:bg-white focus:outline-hidden focus:border-[#181d27] transition-all font-mono"
            />
          </div>
          <div className="flex gap-1">
            {[2, 3, 4, 7].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTripLengthNights(n)}
                className={`px-2.5 py-2 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer ${
                  tripLengthNights === n
                    ? 'bg-[#181d27] text-white border-[#181d27] shadow-2xs'
                    : 'bg-[#faf9f5] text-gray-700 border-[#e4e1d7] hover:bg-[#f0ede6]'
                }`}
              >
                {n}n
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Date Window */}
      <div>
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          Possible Date Window
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="block text-[10px] text-gray-400 mb-1">Earliest Start</span>
            <input
              type="date"
              required
              value={dateWindowStart}
              onChange={(e) => setDateWindowStart(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-[#faf9f5] border border-[#e4e1d7] rounded-lg focus:bg-white focus:outline-hidden focus:border-[#181d27] transition-all font-mono"
            />
          </div>

          <div>
            <span className="block text-[10px] text-gray-400 mb-1">Latest End</span>
            <input
              type="date"
              required
              value={dateWindowEnd}
              onChange={(e) => setDateWindowEnd(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-[#faf9f5] border border-[#e4e1d7] rounded-lg focus:bg-white focus:outline-hidden focus:border-[#181d27] transition-all font-mono"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-3 py-2.5 px-4 bg-[#181d27] hover:bg-black text-white font-medium text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Initializing Room...</span>
          </>
        ) : (
          <>
            <span>Create Splitroom</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </>
        )}
      </button>
    </form>
  );
};

