import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  PieChart,
  Users,
  Plane,
  Home,
  Compass,
  Utensils,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  TrendingUp,
  Receipt,
  CheckCircle2,
  CreditCard,
  Car,
  Layers,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import type { RoomState, TripBudget, BudgetItem } from '../types/index.ts';

interface BudgetPanelProps {
  room: RoomState;
  currentUserId?: string;
  onUpdateBudget: (budget: Partial<TripBudget>) => Promise<any>;
  onAddBudgetItem: (item: Partial<BudgetItem>) => Promise<any>;
  onDeleteBudgetItem: (itemId: string) => Promise<any>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CA$)' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (A$)' },
];

export const BudgetPanel: React.FC<BudgetPanelProps> = ({
  room,
  currentUserId,
  onUpdateBudget,
  onAddBudgetItem,
  onDeleteBudgetItem,
  onShowToast,
}) => {
  const budget = room.budget || {
    currency: 'USD',
    currencySymbol: '$',
    flightsEstimatePerPerson: 450,
    accommodationTotal: 1200,
    activitiesEstimatePerPerson: 120,
    diningDailyPerPerson: 60,
    customItems: [],
    updatedAt: new Date().toISOString(),
  };

  const currencySymbol = budget.currencySymbol || '$';
  const participantsCount = Math.max(1, Object.keys(room.participants || {}).length);
  const tripNights = room.tripLengthNights || 4;
  const tripDays = tripNights + 1;

  // Local draft states for direct numerical inputs
  const [flightsPerPerson, setFlightsPerPerson] = useState<number>(budget.flightsEstimatePerPerson || 0);
  const [accommodationTotal, setAccommodationTotal] = useState<number>(budget.accommodationTotal || 0);
  const [activitiesPerPerson, setActivitiesPerPerson] = useState<number>(budget.activitiesEstimatePerPerson || 0);
  const [diningDaily, setDiningDaily] = useState<number>(budget.diningDailyPerPerson || 0);

  // Custom Item Modal State
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [itemTitle, setItemTitle] = useState<string>('');
  const [itemCost, setItemCost] = useState<string>('');
  const [itemCategory, setItemCategory] = useState<BudgetItem['category']>('activities');
  const [itemCostType, setItemCostType] = useState<'per_person' | 'total_group'>('total_group');
  const [itemNotes, setItemNotes] = useState<string>('');
  const [submittingItem, setSubmittingItem] = useState<boolean>(false);

  // Sync state if room updates remotely
  React.useEffect(() => {
    if (room.budget) {
      setFlightsPerPerson(room.budget.flightsEstimatePerPerson || 0);
      setAccommodationTotal(room.budget.accommodationTotal || 0);
      setActivitiesPerPerson(room.budget.activitiesEstimatePerPerson || 0);
      setDiningDaily(room.budget.diningDailyPerPerson || 0);
    }
  }, [room.budget]);

  // Handle saving core estimates
  const handleSaveEstimates = async (overrides?: Partial<TripBudget>) => {
    try {
      await onUpdateBudget({
        flightsEstimatePerPerson: overrides?.flightsEstimatePerPerson ?? flightsPerPerson,
        accommodationTotal: overrides?.accommodationTotal ?? accommodationTotal,
        activitiesEstimatePerPerson: overrides?.activitiesEstimatePerPerson ?? activitiesPerPerson,
        diningDailyPerPerson: overrides?.diningDailyPerPerson ?? diningDaily,
        currency: overrides?.currency ?? budget.currency,
        currencySymbol: overrides?.currencySymbol ?? budget.currencySymbol,
      });
      onShowToast('Trip budget updated for all room members', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to update budget', 'error');
    }
  };

  const handleCurrencyChange = async (newCode: string) => {
    const found = CURRENCIES.find((c) => c.code === newCode);
    if (!found) return;
    try {
      await onUpdateBudget({
        currency: found.code,
        currencySymbol: found.symbol,
      });
      onShowToast(`Currency updated to ${found.code}`, 'info');
    } catch (err: any) {
      onShowToast('Failed to change currency', 'error');
    }
  };

  // Calculations
  const calculations = useMemo(() => {
    const totalFlights = flightsPerPerson * participantsCount;
    const totalAccommodation = accommodationTotal;
    const totalActivities = activitiesPerPerson * participantsCount;
    const totalDining = diningDaily * tripDays * participantsCount;

    // Custom items calculations
    const customList = budget.customItems || [];
    let customGroupTotal = 0;
    let customPerPersonSum = 0;

    customList.forEach((item) => {
      if (item.costType === 'total_group') {
        customGroupTotal += item.cost;
      } else {
        customPerPersonSum += item.cost;
      }
    });

    const totalCustomAll = customGroupTotal + customPerPersonSum * participantsCount;

    // Grand Totals
    const grandTotal = totalFlights + totalAccommodation + totalActivities + totalDining + totalCustomAll;
    const grandTotalPerPerson = Math.round(grandTotal / participantsCount);

    // Categories breakdown
    const categories = [
      { name: 'Flights', total: totalFlights, perPerson: flightsPerPerson, color: '#2563eb', bg: 'bg-blue-500' },
      {
        name: 'Accommodation',
        total: totalAccommodation,
        perPerson: Math.round(totalAccommodation / participantsCount),
        color: '#059669',
        bg: 'bg-emerald-500',
      },
      {
        name: 'Dining & Drinks',
        total: totalDining,
        perPerson: diningDaily * tripDays,
        color: '#7c3aed',
        bg: 'bg-purple-500',
      },
      {
        name: 'Activities & Tours',
        total: totalActivities,
        perPerson: activitiesPerPerson,
        color: '#d97706',
        bg: 'bg-amber-500',
      },
      {
        name: 'Custom Line Items',
        total: totalCustomAll,
        perPerson: Math.round(totalCustomAll / participantsCount),
        color: '#e11d48',
        bg: 'bg-rose-500',
      },
    ].filter((c) => c.total > 0);

    return {
      totalFlights,
      totalAccommodation,
      totalActivities,
      totalDining,
      totalCustomAll,
      grandTotal,
      grandTotalPerPerson,
      categories,
    };
  }, [
    flightsPerPerson,
    accommodationTotal,
    activitiesPerPerson,
    diningDaily,
    participantsCount,
    tripDays,
    budget.customItems,
  ]);

  // Handle Add Custom Item
  const handleCreateCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const numCost = parseFloat(itemCost);
    if (!itemTitle.trim() || isNaN(numCost) || numCost <= 0) {
      onShowToast('Please enter a valid title and cost', 'info');
      return;
    }

    setSubmittingItem(true);
    try {
      await onAddBudgetItem({
        title: itemTitle.trim(),
        cost: numCost,
        category: itemCategory,
        costType: itemCostType,
        notes: itemNotes.trim(),
        uid: currentUserId,
        userName: currentUserId ? room.participants[currentUserId]?.displayName : 'Member',
      });

      onShowToast(`Added "${itemTitle}" to trip budget`, 'success');
      setShowAddItemModal(false);
      setItemTitle('');
      setItemCost('');
      setItemNotes('');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to add item', 'error');
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await onDeleteBudgetItem(itemId);
      onShowToast('Removed budget line item', 'info');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to delete item', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Banner with Currency Selector */}
      <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#181d27] text-white flex items-center justify-center shadow-2xs shrink-0">
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-gray-900 tracking-tight">
                  Group Trip Budget & Cost Split
                </h2>
                <span className="text-[10px] font-mono font-medium text-gray-600 bg-[#f0ede6] px-2 py-0.5 rounded-full border border-[#e4e1d7]">
                  {participantsCount} Travelers • {tripNights} Nights
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Collaborative cost modeling for <strong className="text-gray-800">{room.destination}</strong>. Changes update live across the room.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Currency Selector */}
            <div className="flex items-center gap-1.5 bg-[#faf9f5] border border-[#e4e1d7] rounded-lg px-2.5 py-1">
              <span className="text-[11px] font-semibold text-gray-500 uppercase font-mono">Currency:</span>
              <select
                value={budget.currency || 'USD'}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="text-xs font-bold text-gray-900 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAddItemModal(true)}
              className="px-3.5 py-1.5 bg-[#181d27] hover:bg-black text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Grand Total KPI Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Trip Cost */}
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-4.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Total Estimated Trip Cost
            </span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-gray-900">
            {currencySymbol}
            {calculations.grandTotal.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400">
            All categories combined for {participantsCount} people
          </p>
        </div>

        {/* Card 2: Cost Per Person */}
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-4.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Estimated Cost Per Person
            </span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-900">
            {currencySymbol}
            {calculations.grandTotalPerPerson.toLocaleString()}
          </div>
          <p className="text-[11px] text-indigo-600 font-medium">
            Even split across {participantsCount} group members
          </p>
        </div>

        {/* Card 3: Accommodation Share */}
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-4.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Shared Lodging / Member
            </span>
            <Home className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-800">
            {currencySymbol}
            {Math.round(calculations.totalAccommodation / participantsCount).toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400">
            {currencySymbol}{accommodationTotal.toLocaleString()} total for {tripNights} nights
          </p>
        </div>

        {/* Card 4: Daily Per-Diem Estimate */}
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-4.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Daily On-Ground / Member
            </span>
            <Utensils className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-900">
            {currencySymbol}
            {Math.round(diningDaily + activitiesPerPerson / tripDays).toLocaleString()}
            <span className="text-xs font-normal text-gray-400">/day</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Meals, drinks, and daily excursions
          </p>
        </div>
      </div>

      {/* 3. Category Distribution Bar */}
      {calculations.grandTotal > 0 && (
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-gray-600" />
              <span>Budget Distribution</span>
            </span>
            <span className="text-xs text-gray-500 font-mono">
              100% of estimated trip expenditure
            </span>
          </div>

          {/* Segmented Progress Bar */}
          <div className="h-3.5 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
            {calculations.categories.map((cat, idx) => {
              const pct = (cat.total / calculations.grandTotal) * 100;
              return (
                <div
                  key={idx}
                  style={{ width: `${pct}%`, backgroundColor: cat.color }}
                  title={`${cat.name}: ${currencySymbol}${cat.total.toLocaleString()} (${pct.toFixed(1)}%)`}
                  className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full hover:opacity-90"
                />
              );
            })}
          </div>

          {/* Category Legend */}
          <div className="flex items-center gap-4 flex-wrap pt-1 text-xs">
            {calculations.categories.map((cat, idx) => {
              const pct = ((cat.total / calculations.grandTotal) * 100).toFixed(0);
              return (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="font-semibold text-gray-800">{cat.name}:</span>
                  <span className="font-mono text-gray-600">
                    {currencySymbol}{cat.total.toLocaleString()} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Core Cost Category Inputs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category 1: Flights & Transit */}
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Plane className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-tight">
                  Flights & Transit
                </h3>
                <p className="text-[11px] text-gray-500">
                  Estimated round-trip airfare or train ticket
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800">
              Per Person
            </span>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400 font-mono">
                {currencySymbol}
              </span>
              <input
                type="number"
                min={0}
                step={25}
                value={flightsPerPerson}
                onChange={(e) => setFlightsPerPerson(Math.max(0, Number(e.target.value)))}
                onBlur={() => handleSaveEstimates()}
                placeholder="450"
                className="w-full pl-8 pr-16 py-2 rounded-lg border border-[#e4e1d7] text-sm font-bold font-mono focus:ring-1 focus:ring-black focus:border-black"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">
                / traveler
              </span>
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span>Quick:</span>
              {[250, 450, 850, 1200].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setFlightsPerPerson(preset);
                    handleSaveEstimates({ flightsEstimatePerPerson: preset });
                  }}
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-mono cursor-pointer transition-colors ${
                    flightsPerPerson === preset
                      ? 'bg-blue-600 text-white border-blue-600 font-bold'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {currencySymbol}{preset}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-[#f0ede6] flex items-center justify-between text-xs text-gray-500">
              <span>{currencySymbol}{flightsPerPerson} × {participantsCount} travelers</span>
              <span className="font-bold font-mono text-gray-900">
                = {currencySymbol}{(flightsPerPerson * participantsCount).toLocaleString()} Total
              </span>
            </div>
          </div>
        </div>

        {/* Category 2: Accommodation */}
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Home className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-tight">
                  Accommodation
                </h3>
                <p className="text-[11px] text-gray-500">
                  Total hotel, Airbnb, or villa booking cost
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
              Group Shared
            </span>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400 font-mono">
                {currencySymbol}
              </span>
              <input
                type="number"
                min={0}
                step={50}
                value={accommodationTotal}
                onChange={(e) => setAccommodationTotal(Math.max(0, Number(e.target.value)))}
                onBlur={() => handleSaveEstimates()}
                placeholder="1200"
                className="w-full pl-8 pr-16 py-2 rounded-lg border border-[#e4e1d7] text-sm font-bold font-mono focus:ring-1 focus:ring-black focus:border-black"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">
                total lodging
              </span>
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span>Quick:</span>
              {[800, 1400, 2200, 3200].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAccommodationTotal(preset);
                    handleSaveEstimates({ accommodationTotal: preset });
                  }}
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-mono cursor-pointer transition-colors ${
                    accommodationTotal === preset
                      ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {currencySymbol}{preset}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-[#f0ede6] flex items-center justify-between text-xs text-gray-500">
              <span>Split by {participantsCount} people ({tripNights} nights)</span>
              <span className="font-bold font-mono text-emerald-700">
                = {currencySymbol}{Math.round(accommodationTotal / participantsCount).toLocaleString()} / person
              </span>
            </div>
          </div>
        </div>

        {/* Category 3: Activities & Tours */}
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-tight">
                  Activities & Tickets
                </h3>
                <p className="text-[11px] text-gray-500">
                  Museums, walking tours, boat rentals, nightlife
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800">
              Per Person
            </span>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400 font-mono">
                {currencySymbol}
              </span>
              <input
                type="number"
                min={0}
                step={10}
                value={activitiesPerPerson}
                onChange={(e) => setActivitiesPerPerson(Math.max(0, Number(e.target.value)))}
                onBlur={() => handleSaveEstimates()}
                placeholder="150"
                className="w-full pl-8 pr-16 py-2 rounded-lg border border-[#e4e1d7] text-sm font-bold font-mono focus:ring-1 focus:ring-black focus:border-black"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">
                / traveler
              </span>
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span>Quick:</span>
              {[60, 120, 200, 350].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setActivitiesPerPerson(preset);
                    handleSaveEstimates({ activitiesEstimatePerPerson: preset });
                  }}
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-mono cursor-pointer transition-colors ${
                    activitiesPerPerson === preset
                      ? 'bg-amber-600 text-white border-amber-600 font-bold'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {currencySymbol}{preset}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-[#f0ede6] flex items-center justify-between text-xs text-gray-500">
              <span>{currencySymbol}{activitiesPerPerson} × {participantsCount} travelers</span>
              <span className="font-bold font-mono text-gray-900">
                = {currencySymbol}{(activitiesPerPerson * participantsCount).toLocaleString()} Total
              </span>
            </div>
          </div>
        </div>

        {/* Category 4: Food & Dining */}
        <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Utensils className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-tight">
                  Dining & Groceries
                </h3>
                <p className="text-[11px] text-gray-500">
                  Daily allowance for meals, cafes, drinks & groceries
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800">
              Daily / Person
            </span>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400 font-mono">
                {currencySymbol}
              </span>
              <input
                type="number"
                min={0}
                step={5}
                value={diningDaily}
                onChange={(e) => setDiningDaily(Math.max(0, Number(e.target.value)))}
                onBlur={() => handleSaveEstimates()}
                placeholder="60"
                className="w-full pl-8 pr-16 py-2 rounded-lg border border-[#e4e1d7] text-sm font-bold font-mono focus:ring-1 focus:ring-black focus:border-black"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">
                / day / person
              </span>
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span>Quick:</span>
              {[35, 60, 95, 140].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDiningDaily(preset);
                    handleSaveEstimates({ diningDailyPerPerson: preset });
                  }}
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-mono cursor-pointer transition-colors ${
                    diningDaily === preset
                      ? 'bg-purple-600 text-white border-purple-600 font-bold'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {currencySymbol}{preset}/d
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-[#f0ede6] flex items-center justify-between text-xs text-gray-500">
              <span>{currencySymbol}{diningDaily}/d × {tripDays} days ({participantsCount} members)</span>
              <span className="font-bold font-mono text-gray-900">
                = {currencySymbol}{(diningDaily * tripDays * participantsCount).toLocaleString()} Total
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Custom Group Line Items Section */}
      <div className="bg-white rounded-xl border border-[#e8e6df] shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-gray-600" />
              <span>Custom Expenses & Shared Group Items</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Specific planned items like rental cars, boat charters, or shared grocery runs.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddItemModal(true)}
            className="px-3 py-1.5 bg-[#faf9f5] hover:bg-gray-100 border border-[#e4e1d7] text-gray-800 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-amber-500" />
            <span>Add Line Item</span>
          </button>
        </div>

        {budget.customItems && budget.customItems.length > 0 ? (
          <div className="divide-y divide-gray-100 border border-[#f0ede6] rounded-xl overflow-hidden">
            {budget.customItems.map((item) => {
              const perPersonCost =
                item.costType === 'total_group'
                  ? Math.round(item.cost / participantsCount)
                  : item.cost;
              const totalCost =
                item.costType === 'total_group'
                  ? item.cost
                  : item.cost * participantsCount;

              return (
                <div
                  key={item.id}
                  className="p-3.5 bg-white hover:bg-[#faf9f5] flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-gray-900">{item.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase bg-gray-100 text-gray-600">
                        {item.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.costType === 'total_group'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.costType === 'total_group' ? 'Shared Across Group' : 'Per Person'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      {item.notes && <span>{item.notes} •</span>}
                      <span>Added by {item.addedByName || 'Member'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold font-mono text-xs text-gray-900">
                        {currencySymbol}{totalCost.toLocaleString()}{' '}
                        <span className="text-[10px] font-normal text-gray-400">total</span>
                      </div>
                      <div className="text-[10px] font-mono text-emerald-700">
                        {currencySymbol}{perPersonCost.toLocaleString()} / person
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      title="Remove line item"
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 bg-[#faf9f5] border border-dashed border-[#e4e1d7] rounded-xl p-4">
            <CreditCard className="w-6 h-6 text-gray-400 mx-auto mb-1.5" />
            <h4 className="text-xs font-bold text-gray-800">No Custom Line Items Added</h4>
            <p className="text-[11px] text-gray-500 max-w-sm mx-auto mt-0.5">
              Add shared group expenses like car rentals, boat trips, airport shuttles, or group bookings.
            </p>
          </div>
        )}
      </div>

      {/* 6. MODAL: ADD CUSTOM BUDGET ITEM */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#e8e6df] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0ede6]">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                <span>Add Budget Line Item</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Item Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunset Sailing Cruise or 7-Seater Rental Van"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Cost ({currencySymbol}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1}
                    placeholder="250"
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs font-mono font-bold focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Cost Type</label>
                  <select
                    value={itemCostType}
                    onChange={(e) => setItemCostType(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-xs bg-white focus:ring-1 focus:ring-black"
                  >
                    <option value="total_group">Total for Group (Split evenly)</option>
                    <option value="per_person">Per Person</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Category</label>
                <select
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value as any)}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-xs bg-white focus:ring-1 focus:ring-black"
                >
                  <option value="activities">🎟️ Activities & Tours</option>
                  <option value="transit">🚗 Car Rental & Transit</option>
                  <option value="accommodation">🏨 Accommodation</option>
                  <option value="dining">🍽️ Food & Dining</option>
                  <option value="flights">✈️ Flights</option>
                  <option value="other">📦 Other Expense</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Includes wine & appetizers; reservation under Sarah"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="pt-3 border-t border-[#f0ede6] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingItem}
                  className="px-4 py-2 bg-[#181d27] hover:bg-black text-white font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  {submittingItem ? 'Adding...' : 'Add to Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
