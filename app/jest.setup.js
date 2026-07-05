// Register matchers like toBeOnTheScreen
require('@testing-library/jest-native/extend-expect');

// Mock expo-haptics with no-op functions
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Soft: 'soft',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock react-native-svg with simple component stubs
jest.mock('react-native-svg', () => {
  const React = require('react');
  const makeStub = (name) => {
    const Comp = (props) => React.createElement(name, props, props && props.children);
    Comp.displayName = name;
    return Comp;
  };
  const Svg = makeStub('Svg');
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Circle: makeStub('Circle'),
    Ellipse: makeStub('Ellipse'),
    G: makeStub('G'),
    Text: makeStub('Text'),
    TSpan: makeStub('TSpan'),
    TextPath: makeStub('TextPath'),
    Path: makeStub('Path'),
    Polygon: makeStub('Polygon'),
    Polyline: makeStub('Polyline'),
    Line: makeStub('Line'),
    Rect: makeStub('Rect'),
    Use: makeStub('Use'),
    Image: makeStub('Image'),
    Symbol: makeStub('Symbol'),
    Defs: makeStub('Defs'),
    LinearGradient: makeStub('LinearGradient'),
    RadialGradient: makeStub('RadialGradient'),
    Stop: makeStub('Stop'),
    ClipPath: makeStub('ClipPath'),
    Pattern: makeStub('Pattern'),
    Mask: makeStub('Mask'),
    ForeignObject: makeStub('ForeignObject'),
    Marker: makeStub('Marker'),
  };
});

// Mock @expo-google-fonts/plus-jakarta-sans
jest.mock('@expo-google-fonts/plus-jakarta-sans', () => ({
  useFonts: () => [true, null],
  PlusJakartaSans_200ExtraLight: 'mock-font',
  PlusJakartaSans_300Light: 'mock-font',
  PlusJakartaSans_400Regular: 'mock-font',
  PlusJakartaSans_500Medium: 'mock-font',
  PlusJakartaSans_600SemiBold: 'mock-font',
  PlusJakartaSans_700Bold: 'mock-font',
  PlusJakartaSans_800ExtraBold: 'mock-font',
  PlusJakartaSans_200ExtraLight_Italic: 'mock-font',
  PlusJakartaSans_300Light_Italic: 'mock-font',
  PlusJakartaSans_400Regular_Italic: 'mock-font',
  PlusJakartaSans_500Medium_Italic: 'mock-font',
  PlusJakartaSans_600SemiBold_Italic: 'mock-font',
  PlusJakartaSans_700Bold_Italic: 'mock-font',
  PlusJakartaSans_800ExtraBold_Italic: 'mock-font',
}));

// Mock @expo-google-fonts/fraunces
jest.mock('@expo-google-fonts/fraunces', () => ({
  useFonts: () => [true, null],
  Fraunces_100Thin: 'mock-font',
  Fraunces_200ExtraLight: 'mock-font',
  Fraunces_300Light: 'mock-font',
  Fraunces_400Regular: 'mock-font',
  Fraunces_500Medium: 'mock-font',
  Fraunces_600SemiBold: 'mock-font',
  Fraunces_700Bold: 'mock-font',
  Fraunces_800ExtraBold: 'mock-font',
  Fraunces_900Black: 'mock-font',
  Fraunces_100Thin_Italic: 'mock-font',
  Fraunces_200ExtraLight_Italic: 'mock-font',
  Fraunces_300Light_Italic: 'mock-font',
  Fraunces_400Regular_Italic: 'mock-font',
  Fraunces_500Medium_Italic: 'mock-font',
  Fraunces_600SemiBold_Italic: 'mock-font',
  Fraunces_700Bold_Italic: 'mock-font',
  Fraunces_800ExtraBold_Italic: 'mock-font',
  Fraunces_900Black_Italic: 'mock-font',
}));

// Stub AsyncStorage using the official jest mock if available
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
