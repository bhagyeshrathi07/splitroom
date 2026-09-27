import React, { useState, useEffect, useMemo } from 'react';
import {
  Plane,
  Car,
  Train,
  Bus,
  MapPin,
  Calendar,
  Users,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Clock,
  DollarSign,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Navigation,
  Compass,
  CreditCard,
  Luggage,
  Shield,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import type { RoomState, MemberTransportPlan, TransportGuide, DateCandidate } from '../types/index.ts';

interface TransportPanelProps {
  room: RoomState;
  currentUserId?: string;
  onAddPlan: (plan: Partial<MemberTransportPlan>) => Promise<any>;
  onDeletePlan: (planId: string) => Promise<any>;
  onFetchTransportGuide: (forceRefresh?: boolean) => Promise<any>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type TransportSubTab = 'flights' | 'cars' | 'transit' | 'arrivals';

export const TransportPanel: React.FC<TransportPanelProps> = ({
  room,
  currentUserId,
  onAddPlan,
  onDeletePlan,
  onFetchTransportGuide,
  onShowToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<TransportSubTab>('flights');
  const [guideLoading, setGuideLoading] = useState<boolean>(false);

  // Flight search state
  const [originAirport, setOriginAirport] = useState<string>('JFK');
  const [cabinClass, setCabinClass] = useState<string>('economy');
  const [flightPassengers, setFlightPassengers] = useState<number>(
    Math.max(1, Object.keys(room.participants || {}).length)
  );

  // Car rental search state
  const [carType, setCarType] = useState<'economy' | 'suv' | 'minivan' | 'luxury'>('minivan');
  const [carPickupSpot, setCarPickupSpot] = useState<'airport' | 'city'>('airport');
  const [estimatedDailyRate, setEstimatedDailyRate] = useState<number>(65);

  // Add arrival form state
  const [showAddPlanModal, setShowAddPlanModal] = useState<boolean>(false);
  const [planType, setPlanType] = useState<'flight' | 'train' | 'car' | 'other'>('flight');
  const [carrierNumber, setCarrierNumber] = useState<string>('');
  const [depLocation, setDepLocation] = useState<string>('');
  const [arrLocation, setArrLocation] = useState<string>('');
  const [arrDateTime, setArrDateTime] = useState<string>('');
  const [planNotes, setPlanNotes] = useState<string>('');
  const [submittingPlan, setSubmittingPlan] = useState<boolean>(false);

  // Find consensus dates
  const topDateCandidate = useMemo(() => {
    if (!room.dateCandidates || room.dateCandidates.length === 0) return null;
    return [...room.dateCandidates].sort((a, b) => {
      const aVotes = Object.values(a.votes || {}).filter(Boolean).length;
      const bVotes = Object.values(b.votes || {}).filter(Boolean).length;
      if (bVotes !== aVotes) return bVotes - aVotes;
      return b.freeCount - a.freeCount;
    })[0];
  }, [room.dateCandidates]);

  const startDateStr = topDateCandidate?.startDate || room.dateWindowStart || '2026-10-01';
  const endDateStr = topDateCandidate?.endDate || room.dateWindowEnd || '2026-10-05';
  const tripNights = topDateCandidate?.nights || room.tripLengthNights || 4;

  const totalMembers = Object.keys(room.participants || {}).length || 1;

  // Destination airport detection
  const primaryAirport = useMemo(() => {
    if (room.transportGuide?.airports?.[0]) {
      return room.transportGuide.airports[0];
    }
    // Simple heuristic
    const destClean = room.destination.toLowerCase();
    if (destClean.includes('barcelona')) return { name: 'Josep Tarradellas Barcelona-El Prat Airport', iata: 'BCN', distance: '12 km southwest', transitTime: '25-35 mins' };
    if (destClean.includes('tokyo')) return { name: 'Tokyo Haneda Airport', iata: 'HND', distance: '15 km south', transitTime: '30 mins' };
    if (destClean.includes('paris')) return { name: 'Paris Charles de Gaulle', iata: 'CDG', distance: '25 km northeast', transitTime: '45 mins' };
    if (destClean.includes('london')) return { name: 'London Heathrow', iata: 'LHR', distance: '23 km west', transitTime: '35 mins' };
    if (destClean.includes('new york') || destClean.includes('nyc')) return { name: 'John F. Kennedy International', iata: 'JFK', distance: '26 km southeast', transitTime: '50 mins' };
    if (destClean.includes('rome')) return { name: 'Rome Leonardo da Vinci-Fiumicino', iata: 'FCO', distance: '30 km southwest', transitTime: '35 mins' };

    const firstWord = room.destination.split(',')[0].replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
    return {
      name: `${room.destination} Airport`,
      iata: firstWord || 'AIR',
      distance: '15 km from center',
      transitTime: '30 mins',
    };
  }, [room.transportGuide, room.destination]);

  // Load transport guide on mount if not loaded yet
  useEffect(() => {
    if (!room.transportGuide && room.destination) {
      setGuideLoading(true);
      onFetchTransportGuide(false)
        .catch(() => {})
        .finally(() => setGuideLoading(false));
    }
  }, [room.code, room.destination, room.transportGuide]);

  const handleRefreshGuide = async () => {
    setGuideLoading(true);
    try {
      await onFetchTransportGuide(true);
      onShowToast('Transport guide refreshed with Gemini AI intelligence', 'success');
    } catch {
      onShowToast('Failed to refresh guide', 'error');
    } finally {
      setGuideLoading(false);
    }
  };

  // Build Flight Deep Search URLs
  const flightSearchUrls = useMemo(() => {
    const origin = originAirport.toUpperCase().trim() || 'NYC';
    const dest = primaryAirport.iata || room.destination;

    return {
      googleFlights: `https://www.google.com/travel/flights?q=Flights%20from%20${origin}%20to%20${dest}%20on%20${startDateStr}%20through%20${endDateStr}`,
      skyscanner: `https://www.skyscanner.com/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${startDateStr.replace(/-/g, '').slice(2)}/${endDateStr.replace(/-/g, '').slice(2)}/?adults=${flightPassengers}`,
      kayak: `https://www.kayak.com/flights/${origin}-${dest}/${startDateStr}/${endDateStr}/${flightPassengers}adults`,
      rome2rio: `https://www.rome2rio.com/s/${encodeURIComponent(origin)}/${encodeURIComponent(room.destination)}`,
    };
  }, [originAirport, primaryAirport.iata, room.destination, startDateStr, endDateStr, flightPassengers]);

  // Build Car Rental Deep Search URLs
  const carRentalUrls = useMemo(() => {
    const pickupLoc = carPickupSpot === 'airport' ? primaryAirport.iata : room.destination;
    const cleanDest = encodeURIComponent(pickupLoc);

    return {
      kayak: `https://www.kayak.com/cars/${cleanDest}/${startDateStr}/${endDateStr}`,
      rentalcars: `https://www.rentalcars.com/search-results?locationName=${cleanDest}&dropLocationName=${cleanDest}&puDay=${startDateStr.slice(8, 10)}&puMonth=${startDateStr.slice(5, 7)}&puYear=${startDateStr.slice(0, 4)}&doDay=${endDateStr.slice(8, 10)}&doMonth=${endDateStr.slice(5, 7)}&doYear=${endDateStr.slice(0, 4)}`,
      skyscanner: `https://www.skyscanner.com/carhire/search?pick_up=${cleanDest}&drop_off=${cleanDest}&pick_up_date=${startDateStr}&drop_off_date=${endDateStr}`,
      expedia: `https://www.expedia.com/Cars-Search?locn=${cleanDest}&d1=${startDateStr}&d2=${endDateStr}`,
      googleMaps: `https://www.google.com/maps/search/?api=1&query=Car%20Rental%20${encodeURIComponent(room.destination)}`,
    };
  }, [carPickupSpot, primaryAirport.iata, room.destination, startDateStr, endDateStr]);

  // Submit Member Arrival Plan
  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrierNumber.trim()) {
      onShowToast('Please enter flight or vehicle number', 'info');
      return;
    }
    if (!currentUserId) {
      onShowToast('Please sign in to post arrival plans', 'info');
      return;
    }

    setSubmittingPlan(true);
    try {
      await onAddPlan({
        uid: currentUserId,
        userName: room.participants[currentUserId]?.displayName || 'Member',
        type: planType,
        carrierOrFlightNumber: carrierNumber,
        departureLocation: depLocation || originAirport,
        arrivalLocation: arrLocation || primaryAirport.iata,
        arrivalDateTime: arrDateTime || `${startDateStr} 10:00 AM`,
        notes: planNotes,
      });

      onShowToast('Arrival details added to group board!', 'success');
      setShowAddPlanModal(false);
      setCarrierNumber('');
      setDepLocation('');
      setArrLocation('');
      setArrDateTime('');
      setPlanNotes('');
      setActiveSubTab('arrivals');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to add arrival plan', 'error');
    } finally {
      setSubmittingPlan(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await onDeletePlan(planId);
      onShowToast('Removed arrival plan', 'info');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to delete plan', 'error');
    }
  };

  // Car Rental Cost Breakdown
  const totalRentalCost = estimatedDailyRate * tripNights;
  const perPersonCost = Math.round(totalRentalCost / Math.max(1, totalMembers));

  const guide = room.transportGuide;

  return (
    <div className="space-y-5">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#181d27] text-white flex items-center justify-center shadow-2xs shrink-0">
              <Plane className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-gray-900 tracking-tight">
                  Flights, Transit & Car Rentals
                </h2>
                <span className="text-[10px] font-mono font-medium text-gray-600 bg-[#f0ede6] px-2 py-0.5 rounded-full border border-[#e4e1d7]">
                  {room.destination}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Target dates: <strong className="text-gray-700">{startDateStr} → {endDateStr}</strong> ({tripNights} nights) • {totalMembers} travelers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRefreshGuide}
              disabled={guideLoading}
              title="Refresh AI Transport & Logistics Guide"
              className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-[#e4e1d7] text-gray-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${guideLoading ? 'animate-spin' : ''}`} />
              <span>{guideLoading ? 'Analyzing...' : 'Refresh AI Tips'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddPlanModal(true)}
              className="px-3.5 py-1.5 bg-[#181d27] hover:bg-black text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Share My Arrival</span>
            </button>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="mt-4 pt-3.5 border-t border-[#f0ede6] flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('flights')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'flights'
                ? 'bg-[#181d27] text-white shadow-2xs'
                : 'bg-[#faf9f5] hover:bg-gray-100 text-gray-700 border border-[#e4e1d7]'
            }`}
          >
            <Plane className="w-3.5 h-3.5 text-amber-400" />
            <span>Flight Search</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('cars')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'cars'
                ? 'bg-[#181d27] text-white shadow-2xs'
                : 'bg-[#faf9f5] hover:bg-gray-100 text-gray-700 border border-[#e4e1d7]'
            }`}
          >
            <Car className="w-3.5 h-3.5 text-blue-500" />
            <span>Car Rental & Vans</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('transit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'transit'
                ? 'bg-[#181d27] text-white shadow-2xs'
                : 'bg-[#faf9f5] hover:bg-gray-100 text-gray-700 border border-[#e4e1d7]'
            }`}
          >
            <Train className="w-3.5 h-3.5 text-emerald-600" />
            <span>Metro & Transfers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('arrivals')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'arrivals'
                ? 'bg-[#181d27] text-white shadow-2xs'
                : 'bg-[#faf9f5] hover:bg-gray-100 text-gray-700 border border-[#e4e1d7]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-600" />
            <span>Group Arrival Board</span>
            {room.transportPlans && room.transportPlans.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[10px] font-mono font-bold">
                {room.transportPlans.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. TAB CONTENT */}

      {/* TAB 1: FLIGHTS */}
      {activeSubTab === 'flights' && (
        <div className="space-y-4">
          {/* Flight Search Controls Box */}
          <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Plane className="w-4 h-4 text-amber-500" />
                <span>Search Group Flights to {room.destination}</span>
              </h3>
              <span className="text-xs text-gray-500 font-mono">
                Arriving into: <strong className="text-gray-800">{primaryAirport.iata}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Origin Airport */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Departure City / Airport
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={originAirport}
                    onChange={(e) => setOriginAirport(e.target.value.toUpperCase())}
                    placeholder="e.g. JFK, SFO, LHR"
                    maxLength={10}
                    className="w-full px-3 py-2 rounded-lg border border-[#e4e1d7] text-xs font-mono font-bold uppercase focus:ring-1 focus:ring-black focus:border-black"
                  />
                  <div className="absolute right-2 top-2 text-[10px] text-gray-400 font-mono pointer-events-none">
                    Origin
                  </div>
                </div>
                {/* Quick origin presets */}
                <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                  <span>Presets:</span>
                  {['JFK', 'SFO', 'LAX', 'LHR', 'ORD'].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setOriginAirport(code)}
                      className={`hover:text-gray-900 cursor-pointer ${originAirport === code ? 'font-bold text-gray-900 underline' : ''}`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination Airport (locked or detected) */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Destination Airport
                </label>
                <div className="w-full px-3 py-2 rounded-lg bg-[#faf9f5] border border-[#e8e6df] text-xs font-mono font-bold text-gray-900">
                  {primaryAirport.iata} ({room.destination.split(',')[0]})
                </div>
                <p className="text-[10px] text-gray-400 mt-1 truncate">
                  {primaryAirport.name}
                </p>
              </div>

              {/* Flight Dates */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Trip Window
                </label>
                <div className="w-full px-3 py-2 rounded-lg bg-[#faf9f5] border border-[#e8e6df] text-xs font-mono text-gray-800">
                  {startDateStr} → {endDateStr}
                </div>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                  ● {tripNights} Nights consensus window
                </p>
              </div>

              {/* Passengers & Class */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Travelers & Class
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={flightPassengers}
                    onChange={(e) => setFlightPassengers(Number(e.target.value))}
                    className="w-1/2 px-2.5 py-2 rounded-lg border border-[#e4e1d7] text-xs bg-white focus:ring-1 focus:ring-black"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'Guest' : 'Guests'}
                      </option>
                    ))}
                  </select>

                  <select
                    value={cabinClass}
                    onChange={(e) => setCabinClass(e.target.value)}
                    className="w-1/2 px-2 py-2 rounded-lg border border-[#e4e1d7] text-xs bg-white focus:ring-1 focus:ring-black"
                  >
                    <option value="economy">Economy</option>
                    <option value="premium">Premium</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Pre-filled with room size
                </p>
              </div>
            </div>

            {/* Direct Flight Search Aggregator Launchers */}
            <div className="pt-3 border-t border-[#f0ede6]">
              <span className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                Launch Live Flight Search with Exact Dates:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {/* Google Flights */}
                <a
                  href={flightSearchUrls.googleFlights}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/90 text-blue-900 transition-all shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      G
                    </div>
                    <div>
                      <div className="font-bold text-xs">Google Flights</div>
                      <div className="text-[10px] text-blue-700">Track best price graph</div>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                </a>

                {/* Skyscanner */}
                <a
                  href={flightSearchUrls.skyscanner}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100/90 text-sky-900 transition-all shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                      S
                    </div>
                    <div>
                      <div className="font-bold text-xs">Skyscanner</div>
                      <div className="text-[10px] text-sky-700">Search 1,000+ airlines</div>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                </a>

                {/* Kayak */}
                <a
                  href={flightSearchUrls.kayak}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-orange-200 bg-orange-50/70 hover:bg-orange-100/90 text-orange-900 transition-all shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold text-xs">
                      K
                    </div>
                    <div>
                      <div className="font-bold text-xs">Kayak Flights</div>
                      <div className="text-[10px] text-orange-700">Hacker fare combinations</div>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                </a>

                {/* Rome2Rio */}
                <a
                  href={flightSearchUrls.rome2rio}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100/90 text-purple-900 transition-all shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                      R
                    </div>
                    <div>
                      <div className="font-bold text-xs">Rome2Rio</div>
                      <div className="text-[10px] text-purple-700">Door-to-door multimodal</div>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                </a>
              </div>
            </div>
          </div>

          {/* Destination Airport Intelligence Card */}
          <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-gray-500" />
              <span>Commercial Airports Serving {room.destination}</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(guide?.airports || [primaryAirport]).map((apt, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[#faf9f5] border border-[#f0ede6] rounded-xl flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-[#181d27] text-white font-mono font-bold text-xs">
                        {apt.iata}
                      </span>
                      <span className="font-bold text-xs text-gray-900">{apt.name}</span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      📍 {apt.distance} • ⏱️ {apt.transitTime} to center
                    </p>
                  </div>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(apt.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600 cursor-pointer"
                    title="View airport on Google Maps"
                  >
                    <MapPin className="w-4 h-4 text-gray-500" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAR RENTALS */}
      {activeSubTab === 'cars' && (
        <div className="space-y-4">
          {/* Car Search & Group Split Calculator */}
          <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Car className="w-4 h-4 text-blue-600" />
                <span>Group Car Rental Search & Cost Split</span>
              </h3>
              <span className="text-xs text-gray-500">
                {tripNights} days total rental duration
              </span>
            </div>

            {/* Vehicle Category Picker */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'minivan', name: '7-9 Seater Minivan', icon: Users, desc: 'Ideal for full group & luggage', defaultRate: 85 },
                { id: 'suv', name: 'Compact SUV', icon: Compass, desc: '5 seats, elevated ride', defaultRate: 60 },
                { id: 'economy', name: 'Economy Sedan', icon: Car, desc: '4 seats, easy street parking', defaultRate: 40 },
                { id: 'luxury', name: 'Premium / EV', icon: Sparkles, desc: 'Tesla / BMW / Mercedes', defaultRate: 110 },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSelected = carType === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCarType(cat.id as any);
                      setEstimatedDailyRate(cat.defaultRate);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#181d27] text-white border-[#181d27] shadow-2xs'
                        : 'bg-white hover:bg-[#faf9f5] border-[#e4e1d7] text-gray-800'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-2 ${isSelected ? 'text-amber-400' : 'text-gray-500'}`} />
                    <div className="font-bold text-xs">{cat.name}</div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                      {cat.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pick-up location toggle & daily rate slider */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 bg-[#faf9f5] border border-[#f0ede6] rounded-xl space-y-2">
                <span className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                  Pick-up & Drop-off Location
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCarPickupSpot('airport')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      carPickupSpot === 'airport'
                        ? 'bg-white text-gray-900 border border-gray-300 shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    ✈️ Airport Terminal ({primaryAirport.iata})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCarPickupSpot('city')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      carPickupSpot === 'city'
                        ? 'bg-white text-gray-900 border border-gray-300 shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🏢 City Center / Train Station
                  </button>
                </div>
              </div>

              {/* Group Split Cost Breakdown */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    Group Cost Split
                  </span>
                  <p className="text-xs text-emerald-900 mt-0.5">
                    Est. ${estimatedDailyRate}/day × {tripNights} days = <strong>${totalRentalCost} total</strong>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-lg font-bold font-mono text-emerald-900">
                    ${perPersonCost}
                  </span>
                  <span className="block text-[10px] font-medium text-emerald-700">
                    per person ({totalMembers} members)
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Car Rental Aggregators */}
            <div className="pt-3 border-t border-[#f0ede6]">
              <span className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                Compare Live Car Rental Fares:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <a
                  href={carRentalUrls.kayak}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-orange-200 bg-orange-50/70 hover:bg-orange-100 text-orange-900 transition-all shadow-2xs cursor-pointer group"
                >
                  <div>
                    <div className="font-bold text-xs">Kayak Cars</div>
                    <div className="text-[10px] text-orange-700">All major agencies</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                </a>

                <a
                  href={carRentalUrls.rentalcars}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-900 transition-all shadow-2xs cursor-pointer group"
                >
                  <div>
                    <div className="font-bold text-xs">Rentalcars.com</div>
                    <div className="text-[10px] text-blue-700">Free cancellation deals</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                </a>

                <a
                  href={carRentalUrls.skyscanner}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100 text-sky-900 transition-all shadow-2xs cursor-pointer group"
                >
                  <div>
                    <div className="font-bold text-xs">Skyscanner Car Hire</div>
                    <div className="text-[10px] text-sky-700">Fuel policy & reviews</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                </a>

                <a
                  href={carRentalUrls.googleMaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 transition-all shadow-2xs cursor-pointer group"
                >
                  <div>
                    <div className="font-bold text-xs">Google Maps Rental</div>
                    <div className="text-[10px] text-emerald-700">Nearby airport lots</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                </a>
              </div>
            </div>
          </div>

          {/* AI Driving Feasibility & Day Trips */}
          {guide?.carRentalAdvice && (
            <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5 space-y-3">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>AI Car Rental Assessment for {room.destination}</span>
              </h4>

              <div className="p-3.5 bg-[#faf9f5] border border-[#f0ede6] rounded-xl text-xs space-y-2 leading-relaxed text-gray-700">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                      guide.carRentalAdvice.isRecommended
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {guide.carRentalAdvice.isRecommended ? 'Recommended' : 'Public Transit Preferred in City'}
                  </span>
                  <span className="font-semibold text-gray-800">
                    Recommended Vehicle: {guide.carRentalAdvice.recommendedVehicle}
                  </span>
                </div>

                <p>{guide.carRentalAdvice.reason}</p>
                <p>
                  <strong>Parking Note:</strong> {guide.carRentalAdvice.parkingAdvice}
                </p>

                {guide.carRentalAdvice.recommendedDayTrips?.length > 0 && (
                  <div className="pt-2 border-t border-[#f0ede6]">
                    <span className="font-bold text-gray-900 block mb-1">
                      Top Day Trips Worth Renting a Car For:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                      {guide.carRentalAdvice.recommendedDayTrips.map((trip, idx) => (
                        <li key={idx}>{trip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LOCAL TRANSIT & TRANSFERS */}
      {activeSubTab === 'transit' && (
        <div className="space-y-4">
          {/* Airport Transfers Grid */}
          <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Bus className="w-4 h-4 text-emerald-600" />
              <span>Airport to City Center Transfer Options</span>
            </h3>
            <p className="text-xs text-gray-500">
              Convenient transit routes from {primaryAirport.name} into central accommodations:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {(guide?.airportTransfers || [
                { mode: 'Airport Express Shuttle / Train', duration: '25-35 mins', estimatedCost: '$8-12', description: 'Direct service to central plazas.' },
                { mode: 'Official Taxi / Rideshare', duration: '20-40 mins', estimatedCost: '$35-50 total', description: 'Convenient for groups splitting 1 car.' },
                { mode: 'Metro / Subway', duration: '40-50 mins', estimatedCost: '$4-6', description: 'Requires 1 transfer to downtown line.' },
              ]).map((transfer, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-[#faf9f5] border border-[#f0ede6] rounded-xl flex flex-col justify-between space-y-2"
                >
                  <div>
                    <div className="font-bold text-xs text-gray-900 mb-1">{transfer.mode}</div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">{transfer.description}</p>
                  </div>

                  <div className="pt-2 border-t border-[#f0ede6] flex items-center justify-between text-[11px] text-gray-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {transfer.duration}
                    </span>
                    <span className="font-bold text-emerald-700">{transfer.estimatedCost}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Public Transit Card & Apps */}
          <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-600" />
              <span>Recommended Public Transit Passes & Apps</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 text-xs">
                    {guide?.publicTransit?.systemName || `${room.destination} Metro System`}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 font-mono font-bold text-[10px]">
                    {guide?.publicTransit?.passPrice || '$15-25'}
                  </span>
                </div>
                <div className="font-semibold text-gray-800">
                  Best Pass: {guide?.publicTransit?.recommendedPass || 'Multi-Day Tourist Unlimited Pass'}
                </div>
                <p className="text-gray-600 text-[11px] leading-relaxed">
                  {guide?.publicTransit?.summary ||
                    'Unlimited rides across subway, trams, and urban buses. Valid throughout all central tourist zones.'}
                </p>
              </div>

              {/* Useful Apps & Train Stations */}
              <div className="p-4 bg-[#faf9f5] border border-[#f0ede6] rounded-xl space-y-3 text-xs">
                <div>
                  <span className="font-bold text-gray-900 block mb-1.5 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-gray-500" />
                    Essential Transit Apps to Install:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(guide?.publicTransit?.usefulApps || ['Citymapper', 'Google Maps', 'Uber / FreeNow']).map(
                      (app, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-white border border-[#e4e1d7] rounded-md font-medium text-[11px] text-gray-800 shadow-2xs"
                        >
                          {app}
                        </span>
                      )
                    )}
                  </div>
                </div>

                {guide?.trainStations && guide.trainStations.length > 0 && (
                  <div className="pt-2 border-t border-[#f0ede6]">
                    <span className="font-bold text-gray-900 block mb-1 flex items-center gap-1.5">
                      <Train className="w-3.5 h-3.5 text-gray-500" />
                      Main High-Speed Train Station:
                    </span>
                    <p className="text-[11px] text-gray-600">
                      <strong>{guide.trainStations[0].name}:</strong> {guide.trainStations[0].notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GROUP ARRIVALS BOARD */}
      {activeSubTab === 'arrivals' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Group Arrival Board & Ride Coordination</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Share when and where you land so group members arriving around the same time can share taxis or shuttles.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddPlanModal(true)}
                className="px-3.5 py-1.5 bg-[#181d27] hover:bg-black text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Add My Flight</span>
              </button>
            </div>

            {/* List of Member Plans */}
            {room.transportPlans && room.transportPlans.length > 0 ? (
              <div className="space-y-3">
                {room.transportPlans.map((plan) => {
                  const isMine = plan.uid === currentUserId;
                  return (
                    <div
                      key={plan.id}
                      className="p-4 rounded-xl border border-[#e8e6df] bg-[#faf9f5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0">
                          {plan.type === 'flight' ? <Plane className="w-4 h-4" /> : <Train className="w-4 h-4" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-gray-900">
                              {plan.userName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-gray-300 font-mono font-bold text-[10px] text-gray-800">
                              {plan.carrierOrFlightNumber}
                            </span>
                            {isMine && (
                              <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase">
                                You
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-gray-600 mt-1 flex items-center gap-2 flex-wrap">
                            <span>
                              {plan.departureLocation} → <strong>{plan.arrivalLocation}</strong>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono text-gray-700">
                              <Clock className="w-3 h-3 text-gray-400" />
                              {plan.arrivalDateTime}
                            </span>
                          </div>

                          {plan.notes && (
                            <p className="text-[11px] text-gray-500 italic mt-1 bg-white p-2 rounded-md border border-[#f0ede6]">
                              "{plan.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Delete button if owner */}
                      {isMine && (
                        <button
                          type="button"
                          onClick={() => handleDeletePlan(plan.id)}
                          title="Remove flight plan"
                          className="self-end sm:self-center p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-[#faf9f5] border border-dashed border-[#e4e1d7] rounded-xl p-6">
                <Luggage className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-gray-800">No Arrival Plans Posted Yet</h4>
                <p className="text-[11px] text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                  Once members book flights or trains, share arrival details here so everyone can sync airport meetups.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddPlanModal(true)}
                  className="px-3.5 py-1.5 bg-[#181d27] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-black transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Post First Flight</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MODAL: ADD ARRIVAL / FLIGHT PLAN */}
      {showAddPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#e8e6df] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0ede6]">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Plane className="w-4 h-4 text-amber-500" />
                <span>Post Your Trip Arrival</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPlanModal(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPlan} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Transport Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'flight', label: '✈️ Flight' },
                    { id: 'train', label: '🚆 Train' },
                    { id: 'car', label: '🚗 Car' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPlanType(mode.id as any)}
                      className={`py-1.5 rounded-lg border text-center font-medium cursor-pointer ${
                        planType === mode.id
                          ? 'bg-[#181d27] text-white border-[#181d27]'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Flight / Carrier / Train # <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. United UA 120 or Renfe AVE 3102"
                  value={carrierNumber}
                  onChange={(e) => setCarrierNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Departure City</label>
                  <input
                    type="text"
                    placeholder="e.g. SFO or JFK"
                    value={depLocation}
                    onChange={(e) => setDepLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Arrival City/Airport</label>
                  <input
                    type="text"
                    placeholder={`e.g. ${primaryAirport.iata}`}
                    value={arrLocation}
                    onChange={(e) => setArrLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Arrival Date & Approximate Time</label>
                <input
                  type="text"
                  placeholder={`e.g. ${startDateStr} at 10:30 AM`}
                  value={arrDateTime}
                  onChange={(e) => setArrDateTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Notes for Group (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Checking 1 bag, happy to split Uber/cab"
                  value={planNotes}
                  onChange={(e) => setPlanNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="pt-3 border-t border-[#f0ede6] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlanModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPlan}
                  className="px-4 py-2 bg-[#181d27] hover:bg-black text-white font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  {submittingPlan ? 'Saving...' : 'Add to Group Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
