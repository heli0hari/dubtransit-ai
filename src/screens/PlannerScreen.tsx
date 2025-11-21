
import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Modal,
  TextInput,
  FlatList
} from 'react-native';
import { JourneyPlan, WeatherSnapshot } from '../types';
import { getJourneyPlan, searchLocation } from '../services/geminiService';
import { getWeatherForLocation, getWeatherForLocationAtTime } from '../services/weatherService';
import { parseDurationToMinutes } from '../utils';
import { SAMPLE_STOPS, DUBLIN_LANDMARKS } from '../constants';
import { 
  MapPin, 
  Navigation, 
  Footprints, 
  Bus, 
  Train, 
  TramFront, 
  Search, 
  X, 
  Map as MapIcon,
  LocateFixed,
  ArrowRight
} from 'lucide-react-native';

const COLORS = {
  dubOrange: '#E3CC00',
  dubBlack: '#171717',
  dubGray: '#F5F5F5',
  dubBusBlue: '#00539F',
  dubLuasPurple: '#B3007D',
  dubDartGreen: '#8CC63E',
  white: '#FFFFFF',
  neutral100: '#F5F5F5',
  neutral200: '#E5E5E5',
  neutral400: '#A3A3A3',
  neutral600: '#525252',
  neutral900: '#171717',
};

interface LocationItem {
  name: string;
  lat?: number;
  lon?: number;
  type: 'stop' | 'landmark' | 'current' | 'map_point';
}

export default function PlannerScreen() {
  const [origin, setOrigin] = useState<LocationItem | null>(null);
  const [destination, setDestination] = useState<LocationItem | null>(null);
  const [plan, setPlan] = useState<JourneyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [originWeather, setOriginWeather] = useState<WeatherSnapshot | null>(null);
  const [destinationWeather, setDestinationWeather] = useState<WeatherSnapshot | null>(null);
  
  // Modal State
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectingType, setSelectingType] = useState<'origin' | 'destination'>('origin');
  const [searchQuery, setSearchQuery] = useState('');

  const openModal = (type: 'origin' | 'destination') => {
    setSelectingType(type);
    setSearchQuery('');
    setModalVisible(true);
  };

  const handleSelectLocation = (item: LocationItem) => {
    if (selectingType === 'origin') {
      setOrigin(item);
    } else {
      setDestination(item);
    }
    setModalVisible(false);
  };

  const handleUseCurrentLocation = () => {
    // In a real Native app, use Expo Location or Geolocation API
    // For this demo, we simulate a successful geolocation
    const currentLocation: LocationItem = {
      name: "Current Location",
      lat: 53.3498, // Simulating O'Connell St
      lon: -6.2603,
      type: 'current'
    };
    handleSelectLocation(currentLocation);
  };

  const handleSelectOnMap = () => {
    // In a real app, this would navigate to a map picker screen
    // For this demo, we simulate selecting a point
    const mapPoint: LocationItem = {
      name: "Dropped Pin (53.34, -6.26)",
      lat: 53.3449,
      lon: -6.2595,
      type: 'map_point'
    };
    handleSelectLocation(mapPoint);
  };

  const handlePlan = async () => {
    if (!origin || !destination) return;

    setLoading(true);
    setPlan(null);
    setOriginWeather(null);
    setDestinationWeather(null);

    try {
      // Use the precise names for Gemini prompt
      const result = await getJourneyPlan(origin.name, destination.name);
      setPlan(result);

      if (!result) return;

      const minutes = parseDurationToMinutes(result.totalDuration);
      
      // If we already have coordinates (from local constant), use them. 
      // Otherwise search via Gemini (fallback)
      let originLoc = { lat: origin.lat, lon: origin.lon };
      let destLoc = { lat: destination.lat, lon: destination.lon };

      if (!originLoc.lat) {
         const searchRes = await searchLocation(origin.name);
         if (searchRes) originLoc = { lat: searchRes.lat, lon: searchRes.lon };
      }

      if (!destLoc.lat) {
         const searchRes = await searchLocation(destination.name);
         if (searchRes) destLoc = { lat: searchRes.lat, lon: searchRes.lon };
      }

      // Weather Fetching
      if (originLoc.lat && originLoc.lon) {
        const ow = await getWeatherForLocation(originLoc.lat, originLoc.lon);
        setOriginWeather(ow);
      }

      if (destLoc.lat && destLoc.lon && minutes) {
        const arrivalTime = new Date(Date.now() + minutes * 60 * 1000);
        const dw = await getWeatherForLocationAtTime(destLoc.lat, destLoc.lon, arrivalTime);
        setDestinationWeather(dw);
      }
    } catch (err) {
      console.error('Failed to plan journey', err);
    } finally {
      setLoading(false);
    }
  };

  // Suggestions Logic
  const suggestions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    
    const stops: LocationItem[] = SAMPLE_STOPS.map(s => ({ 
      name: s.stop_name, 
      lat: s.stop_lat, 
      lon: s.stop_lon, 
      type: 'stop' 
    }));
    
    const landmarks: LocationItem[] = DUBLIN_LANDMARKS.map(l => ({
      name: l.name,
      lat: l.lat,
      lon: l.lon,
      type: 'landmark'
    }));

    const all = [...landmarks, ...stops];
    
    if (!query) return all; // Show default popular items
    
    return all.filter(item => item.name.toLowerCase().includes(query));
  }, [searchQuery]);

  const getModeIcon = (mode: string) => {
    switch (mode) {
        case 'BUS': return <Bus size={16} color="white" />;
        case 'LUAS': return <TramFront size={16} color="white" />;
        case 'DART': return <Train size={16} color="white" />;
        case 'WALK': return <Footprints size={16} color="#A3A3A3" />;
        default: return <Navigation size={16} color="white" />;
    }
  };

  const getModeBgColor = (mode: string) => {
    switch (mode) {
        case 'BUS': return COLORS.dubBusBlue;
        case 'LUAS': return COLORS.dubLuasPurple;
        case 'DART': return COLORS.dubDartGreen;
        case 'WALK': return '#E5E5E5';
        default: return COLORS.neutral900;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flexContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>plan<Text style={styles.headerDot}>.</Text></Text>
            <Text style={styles.headerSubtitle}>AI Journey Assistant</Text>
          </View>

          {/* Input Form */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <View style={styles.inputDot} />
              <TouchableOpacity 
                style={styles.inputButton} 
                onPress={() => openModal('origin')}
              >
                <Text style={[styles.inputText, !origin && styles.placeholderText]}>
                  {origin ? origin.name : "Where from?"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
              <View style={[styles.inputDot, styles.inputDotDestination]} />
               <TouchableOpacity 
                style={styles.inputButton} 
                onPress={() => openModal('destination')}
              >
                <Text style={[styles.inputText, !destination && styles.placeholderText]}>
                  {destination ? destination.name : "Where to?"}
                </Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={[styles.planButton, (!origin || !destination) && styles.planButtonDisabled]} 
              onPress={handlePlan}
              disabled={loading || !origin || !destination}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.planButtonText}>GENERATE PLAN</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Results */}
          {plan && (
            <View style={styles.resultsContainer}>
              
              {/* Summary Card */}
              <View style={styles.summaryCard}>
                <Text style={styles.labelSmall}>TOTAL DURATION</Text>
                <Text style={styles.durationText}>{plan.totalDuration}</Text>
                <Text style={styles.summaryText}>{plan.summary}</Text>
              </View>

              {/* Weather Row */}
              {(originWeather || destinationWeather) && (
                <View style={styles.weatherRow}>
                  {originWeather && (
                    <View style={styles.weatherCard}>
                      <Text style={styles.labelSmall}>DEPARTURE</Text>
                      <View style={styles.weatherValueRow}>
                        <Text style={styles.weatherTemp}>{Math.round(originWeather.temperature)}°C</Text>
                      </View>
                      <Text style={styles.weatherCondition}>{originWeather.conditionLabel}</Text>
                    </View>
                  )}
                  {destinationWeather && (
                    <View style={styles.weatherCard}>
                      <Text style={styles.labelSmall}>ARRIVAL</Text>
                      <View style={styles.weatherValueRow}>
                        <Text style={styles.weatherTemp}>{Math.round(destinationWeather.temperature)}°C</Text>
                      </View>
                      <Text style={styles.weatherCondition}>{destinationWeather.conditionLabel}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Timeline Steps */}
              <View style={styles.timelineContainer}>
                <View style={styles.timelineLine} />
                {plan.steps.map((step, idx) => (
                  <View key={idx} style={styles.stepRow}>
                    <View style={[
                      styles.iconCircle, 
                      { backgroundColor: getModeBgColor(step.mode) },
                      step.mode === 'WALK' && styles.walkIconCircle
                    ]}>
                      {getModeIcon(step.mode)}
                    </View>
                    <View style={styles.stepContent}>
                      <View style={styles.stepHeader}>
                        <Text style={styles.modeLabel}>{step.mode}</Text>
                        <View style={styles.stepDurationBadge}>
                          <Text style={styles.stepDurationText}>{step.duration}</Text>
                        </View>
                      </View>
                      <Text style={styles.stepInstruction}>{step.instruction}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {!plan && !loading && (
            <View style={styles.emptyState}>
              <Navigation size={48} color={COLORS.neutral200} />
              <Text style={styles.emptyStateText}>Enter locations to start</Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Picker Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Select {selectingType === 'origin' ? 'Origin' : 'Destination'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
               <X size={24} color={COLORS.neutral900} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.modalSearchContainer}>
             <Search size={20} color={COLORS.neutral400} />
             <TextInput 
                style={styles.modalSearchInput}
                placeholder="Search stops or landmarks"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                clearButtonMode="while-editing"
             />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Static Options */}
            {selectingType === 'origin' && !searchQuery && (
               <TouchableOpacity style={styles.optionRow} onPress={handleUseCurrentLocation}>
                  <View style={styles.optionIconBg}>
                     <LocateFixed size={20} color={COLORS.dubBusBlue} />
                  </View>
                  <View>
                     <Text style={styles.optionTitle}>Current Location</Text>
                     <Text style={styles.optionSubtitle}>Using GPS</Text>
                  </View>
               </TouchableOpacity>
            )}

            {!searchQuery && (
               <TouchableOpacity style={styles.optionRow} onPress={handleSelectOnMap}>
                  <View style={styles.optionIconBg}>
                     <MapIcon size={20} color={COLORS.dubOrange} />
                  </View>
                  <View>
                     <Text style={styles.optionTitle}>Select on Map</Text>
                     <Text style={styles.optionSubtitle}>Choose a point</Text>
                  </View>
               </TouchableOpacity>
            )}

            {/* List Header */}
            <View style={styles.listHeader}>
               <Text style={styles.listHeaderText}>{searchQuery ? 'SEARCH RESULTS' : 'SUGGESTED'}</Text>
            </View>

            {/* Results List */}
            {suggestions.map((item, index) => (
              <TouchableOpacity 
                key={`${item.name}-${index}`} 
                style={styles.resultRow}
                onPress={() => handleSelectLocation(item)}
              >
                <View style={styles.resultIcon}>
                  {item.type === 'stop' ? (
                    <Bus size={16} color={COLORS.neutral400} />
                  ) : (
                    <MapPin size={16} color={COLORS.neutral400} />
                  )}
                </View>
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultTitle}>{item.name}</Text>
                  {item.type === 'stop' && <Text style={styles.resultSubtitle}>Public Transport Stop</Text>}
                </View>
              </TouchableOpacity>
            ))}

             <View style={{height: 40}} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dubGray,
  },
  flexContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100, // Space for bottom tab bar
  },
  headerContainer: {
    marginTop: 20,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.neutral900,
    letterSpacing: -2,
  },
  headerDot: {
    color: COLORS.dubOrange,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: COLORS.neutral600,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.neutral900,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
    position: 'relative',
  },
  inputDot: {
    position: 'absolute',
    left: 12,
    top: 18,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.neutral900,
    zIndex: 1,
  },
  inputDotDestination: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.neutral900,
  },
  inputButton: {
    backgroundColor: COLORS.dubGray,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingLeft: 32,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.neutral200,
  },
  inputText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.neutral900,
  },
  placeholderText: {
    color: COLORS.neutral400,
  },
  planButton: {
    backgroundColor: COLORS.neutral900,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  planButtonDisabled: {
    opacity: 0.5,
  },
  planButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    letterSpacing: 2,
    fontSize: 14,
  },
  resultsContainer: {
    gap: 16,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.dubOrange,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  labelSmall: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.neutral400,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  durationText: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.neutral900,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: COLORS.neutral600,
    lineHeight: 20,
    fontWeight: '500',
  },
  weatherRow: {
    flexDirection: 'row',
    gap: 12,
  },
  weatherCard: {
    flex: 1,
    backgroundColor: '#F0F0F0', 
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
  },
  weatherValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherTemp: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.neutral900,
  },
  weatherCondition: {
    fontSize: 12,
    color: COLORS.neutral600,
    marginTop: 2,
  },
  timelineContainer: {
    marginTop: 8,
    position: 'relative',
    paddingLeft: 4,
  },
  timelineLine: {
    position: 'absolute',
    left: 23, 
    top: 20,
    bottom: 20,
    width: 2,
    backgroundColor: COLORS.neutral200,
    zIndex: 0,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'flex-start',
    zIndex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.dubGray,
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  walkIconCircle: {
    borderWidth: 4,
    borderColor: COLORS.dubGray,
  },
  stepContent: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modeLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.neutral400,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stepDurationBadge: {
    backgroundColor: COLORS.dubGray,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stepDurationText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.neutral900,
  },
  stepInstruction: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.neutral900,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    opacity: 0.5,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.neutral400,
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral100,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.neutral900,
  },
  closeButton: {
    padding: 4,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutral100,
    margin: 20,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 48,
  },
  modalSearchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.neutral900,
    height: '100%',
  },
  modalContent: {
    flex: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral100,
  },
  optionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.neutral900,
  },
  optionSubtitle: {
    fontSize: 12,
    color: COLORS.neutral400,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.neutral100,
  },
  listHeaderText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.neutral400,
    letterSpacing: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral100,
  },
  resultIcon: {
    marginRight: 16,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.neutral900,
  },
  resultSubtitle: {
    fontSize: 12,
    color: COLORS.neutral400,
    marginTop: 2,
  },
});
