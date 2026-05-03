import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ThemeProvider } from './src/context/ThemeContext';
import SplashScreen          from './src/screens/SplashScreen';
import HomeScreen            from './src/screens/HomeScreen';
import GameScreen            from './src/screens/GameScreen';
import ResultsScreen         from './src/screens/ResultsScreen';
import AdminScreen           from './src/screens/AdminScreen';
import InfinityScreen        from './src/screens/InfinityScreen';
import InfinityResultsScreen from './src/screens/InfinityResultsScreen';
import QuienesSomosScreen    from './src/screens/QuienesSomosScreen';
import ConfiguracionScreen   from './src/screens/ConfiguracionScreen';
import { useAppUpdater } from './src/utils/appUpdater';

const Stack = createStackNavigator();

export default function App() {
  useAppUpdater();

  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash"          component={SplashScreen} />
          <Stack.Screen name="Home"            component={HomeScreen} />
          <Stack.Screen name="Game"            component={GameScreen} />
          <Stack.Screen name="Results"         component={ResultsScreen} />
          <Stack.Screen name="Admin"           component={AdminScreen} />
          <Stack.Screen name="Infinity"        component={InfinityScreen} />
          <Stack.Screen name="InfinityResults" component={InfinityResultsScreen} />
          <Stack.Screen name="QuienesSomos"    component={QuienesSomosScreen} />
          <Stack.Screen name="Configuracion"   component={ConfiguracionScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
