import {
  useFonts as usePlusJakarta,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  useFonts as useFraunces,
  Fraunces_500Medium_Italic,
  Fraunces_700Bold_Italic,
} from '@expo-google-fonts/fraunces';

/**
 * useAppFonts — single hook that loads the full Peggy type stack.
 * Returns true once both Plus Jakarta Sans and Fraunces have hydrated.
 * Returns the loading error (if any) so the caller can surface it.
 */
export function useAppFonts(): { loaded: boolean; error: Error | null } {
  const [jakartaLoaded, jakartaError] = usePlusJakarta({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [frauncesLoaded, frauncesError] = useFraunces({
    Fraunces_500Medium_Italic,
    Fraunces_700Bold_Italic,
  });

  return {
    loaded: jakartaLoaded && frauncesLoaded,
    error: jakartaError ?? frauncesError ?? null,
  };
}
