export interface Participant {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  calendarSynced: boolean;
  online: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

export interface BusyInterval {
  start: string; // ISO string
  end: string;   // ISO string
}

export interface DateCandidate {
  id: string; // e.g. "2026-10-17_2026-10-20"
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  nights: number;
  freeCount: number;
  totalSynced: number;
  freeMembers: string[]; // member UIDs or names
  busyMembers: string[];
  weekendNights: number;
  reason?: string; // One sentence from Gemini
  votes: { [uid: string]: boolean }; // uid -> voted
}

export interface Venue {
  id: string;
  name: string;
  category: 'lodging' | 'food' | 'activity';
  rating?: number;
  userRatingsTotal?: number;
  address?: string;
  mapsUri?: string;
  summary?: string;
  upvotes: string[];   // user UIDs
  downvotes: string[]; // user UIDs
}

export interface ItineraryStop {
  id: string;
  venueId?: string;
  title: string;
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  description: string;
  address?: string;
  mapsUri?: string;
  coordinates?: { lat: number; lng: number };
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  theme?: string;
  stops: ItineraryStop[];
}

export interface Itinerary {
  id: string;
  title: string;
  summary: string;
  days: ItineraryDay[];
  generatedAt: string;
  selectedDateRangeId: string;
}

export interface PlaceSuggestion {
  id: string;
  name: string;
  secondaryText: string;
  fullText: string;
  lat: number;
  lng: number;
  countryCode?: string;
  type?: string;
}

export interface MemberTransportPlan {
  id: string;
  uid: string;
  userName: string;
  type: 'flight' | 'train' | 'car' | 'other';
  carrierOrFlightNumber: string;
  departureLocation: string;
  arrivalLocation: string;
  arrivalDateTime: string;
  notes?: string;
  createdAt: string;
}

export interface TransportGuide {
  destination: string;
  airports: {
    name: string;
    iata: string;
    distance: string;
    transitTime: string;
  }[];
  airportTransfers: {
    mode: string;
    description: string;
    duration: string;
    estimatedCost: string;
  }[];
  publicTransit: {
    systemName: string;
    recommendedPass: string;
    passPrice: string;
    summary: string;
    usefulApps: string[];
  };
  carRentalAdvice: {
    isRecommended: boolean;
    reason: string;
    parkingAdvice: string;
    recommendedDayTrips: string[];
    recommendedVehicle: string;
  };
  trainStations?: {
    name: string;
    notes: string;
  }[];
}

export interface BudgetItem {
  id: string;
  category: 'flights' | 'accommodation' | 'activities' | 'dining' | 'transit' | 'other';
  title: string;
  cost: number;
  costType: 'per_person' | 'total_group';
  notes?: string;
  addedByUid?: string;
  addedByName?: string;
  createdAt: string;
}

export interface TripBudget {
  currency: string;
  currencySymbol: string;
  flightsEstimatePerPerson: number;
  accommodationTotal: number;
  activitiesEstimatePerPerson: number;
  diningDailyPerPerson: number;
  customItems: BudgetItem[];
  updatedAt: string;
}

export interface RoomState {
  code: string;
  creatorId: string;
  creatorName: string;
  destination: string;
  coordinates?: { lat: number; lng: number };
  tripLengthNights: number;
  dateWindowStart: string;
  dateWindowEnd: string;
  createdAt: string;
  updatedAt: string;
  vibeNotes: string[];
  participants: { [uid: string]: Participant };
  userBusyTimes: { [uid: string]: BusyInterval[] };
  dateCandidates: DateCandidate[];
  venues: Venue[];
  itinerary: Itinerary | null;
  transportPlans?: MemberTransportPlan[];
  transportGuide?: TransportGuide | null;
  budget?: TripBudget;
  activeOnlineUids: string[];
}
