import * as Updates from 'expo-updates';

/**
 * Verifica si hay una actualización OTA disponible y la aplica.
 *
 * Comportamiento:
 *  - Si hay update disponible → descarga y recarga la app automáticamente.
 *  - Si no hay update o hay error de red → no hace nada (falla silenciosa).
 *  - En desarrollo (__DEV__) → no hace nada para no interrumpir el workflow.
 *
 * @param {Function} [onUpdateFound]   Callback cuando se detecta y descarga un update.
 *                                     Recibe el objeto `update` de expo-updates.
 * @param {Function} [onUpdateError]   Callback cuando hay un error (log interno incluido).
 */
export async function checkForUpdate(onUpdateFound, onUpdateError) {
  // En modo desarrollo expo-updates no funciona — saltamos
  if (__DEV__) return;

  try {
    const update = await Updates.checkForUpdateAsync();

    if (!update.isAvailable) return; // Sin novedad

    // Hay update → descargarlo
    await Updates.fetchUpdateAsync();

    // Notificar al caller antes de recargar (para mostrar un toast, etc.)
    onUpdateFound?.(update);

    // Pequeño delay para que el usuario alcance a leer el mensaje
    await new Promise(res => setTimeout(res, 1500));

    // Recargar con la nueva versión
    await Updates.reloadAsync();

  } catch (error) {
    // Errores de red / servidor → silencioso para no molestar al usuario
    // pero lo registramos y notificamos al caller si quiere loggearlo
    console.warn('[appUpdater] checkForUpdate error:', error?.message);
    onUpdateError?.(error);
  }
}

/**
 * Hook React que corre checkForUpdate una sola vez al montar el componente.
 * Úsalo en App.js o en tu pantalla raíz.
 *
 * Ejemplo:
 *   import { useAppUpdater } from './src/utils/appUpdater';
 *   export default function App() {
 *     useAppUpdater();
 *     return <NavigationContainer>...</NavigationContainer>;
 *   }
 */
export function useAppUpdater({ onUpdateFound, onUpdateError } = {}) {
  const { useEffect } = require('react');
  useEffect(() => {
    checkForUpdate(onUpdateFound, onUpdateError);
  }, []);
}
