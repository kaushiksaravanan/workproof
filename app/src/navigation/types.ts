/**
 * Root stack param list for the Workproof app.
 *
 * Onboarding short-circuits via AsyncStorage @workproof/onboarded; everything
 * else hangs off the Home tab. ProofDetail is the only route that takes a
 * param (the proof id, used to look up the entry in the Zustand store).
 */
export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  LogWork: undefined;
  ProofDetail: { id: string };
  History: undefined;
};
