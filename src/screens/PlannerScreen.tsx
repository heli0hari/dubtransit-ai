import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import { JourneyPlan, WeatherSnapshot } from '../types';
import { getJourneyPlan, searchLocation } from '../services/geminiService';
import { getWeatherForLocation, getWeatherForLocationAtTime } from '../services/weatherService';
import { parseDurationToMinutes } from '../utils';
import { MapPin, Navigation, Footprints, Bus, Train, TramFront, ArrowRight, Thermometer } from 'lucide-react-native';

const COLORS = {
  dubOrange: '#E3CC00',
  dubBlack: '#171717',
  dubGray: '#F5F5F5',
  dubBusBlue: '#00539F',
  dubLuasPurple: '#B3007D',
  dubDartGreen: '#8CC63E',
  white: '#FFFFFF',
  neutral200: '#E5E5E5',
  neutral400: '#A3A3A3',
  neutral600: '#525252',
  neutral900: '#171717',
};

export default function PlannerScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [plan, setPlan] = useState<JourneyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [originWeather, setOriginWeather] = useState<WeatherSnapshot | null>(null);
  const [destinationWeather, setDestinationWeather] = useState<WeatherSnapshot | null>(null);

  const handlePlan = async () => {
    if (!origin || !destination) return;

    setLoading(true);
    setPlan(null); // Reset plan while loading new one
    setOriginWeather(null);
    setDestinationWeather(null);

    try {
      const result = await getJourneyPlan(origin, destination);
      setPlan(result);

      if (!result) return;

      const minutes = parseDurationToMinutes(result.totalDuration);
      
      // Parallel location search for weather
      const [originLoc, destLoc] = await Promise.all([
        searchLocation(origin),
        searchLocation(destination),
      ]);

      if (originLoc) {
        const ow = await getWeatherForLocation(originLoc.lat, originLoc.lon);
        setOriginWeather(ow);
      }

      if (destLoc && minutes) {
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
              <TextInput 
                style={styles.input}
                placeholder="Where from?"
                placeholderTextColor={COLORS.neutral400}
                value={origin}
                onChangeText={setOrigin}
              />
            </View>
            <View style={styles.inputGroup}>
              <View style={[styles.inputDot, styles.inputDotDestination]} />
              <TextInput 
                style={styles.input}
                placeholder="Where to?"
                placeholderTextColor={COLORS.neutral400}
                value={destination}
                onChangeText={setDestination}
              />
            </View>
            
            <TouchableOpacity 
              style={styles.planButton} 
              onPress={handlePlan}
              disabled={loading}
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
                {/* Vertical Line */}
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
  input: {
    backgroundColor: COLORS.dubGray,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingLeft: 32,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.neutral900,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.neutral200,
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
    backgroundColor: '#F0F0F0', // slightly darker than dubGray
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
    borderColor: COLORS.dubGray, // Matches background to simulate gap
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  walkIconCircle: {
    borderWidth: 4,
    borderColor: COLORS.dubGray, // Outer ring
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
});
