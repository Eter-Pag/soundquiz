import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen  from './src/screens/SplashScreen';
import HomeScreen    from './src/screens/HomeScreen';
import GameScreen    from './src/screens/GameScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import AdminScreen   from './src/screens/AdminScreen';
import { useAppUpdater } from './src/utils/appUpdater';

const Stack = createStackNavigator();

export default function App() {
  useAppUpdater();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash"   component={SplashScreen} />
        <Stack.Screen name="Home"     component={HomeScreen} />
        <Stack.Screen name="Game"     component={GameScreen} />
        <Stack.Screen name="Results"  component={ResultsScreen} />
        <Stack.Screen name="Admin"    component={AdminScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
