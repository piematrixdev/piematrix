/**
 * Navigation — React Navigation native stack.
 * Provides native iOS swipe-back gestures and transitions.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './HomeScreen';
import ShopScreen from './ShopScreen';
import SupportScreen from './SupportScreen';
import ProductDetailScreen from './ProductDetailScreen';

export type RootStackParamList = {
  Home: undefined;
  SkyWatch: undefined;
  Shop: undefined;
  Support: undefined;
  ProductDetail: { handle: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  /** Render the SkyWatch screen content (passed from App since it has complex state) */
  renderSkyWatch: () => React.ReactElement;
}

export default function Navigation({ renderSkyWatch }: Props) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          contentStyle: { backgroundColor: '#0a0a0c' },
        }}
      >
        <Stack.Screen name="Home">
          {(props) => <HomeScreenWrapper {...props} />}
        </Stack.Screen>
        <Stack.Screen name="SkyWatch">
          {() => renderSkyWatch()}
        </Stack.Screen>
        <Stack.Screen name="Shop">
          {(props) => <ShopScreen onClose={() => props.navigation.goBack()} />}
        </Stack.Screen>
        <Stack.Screen name="Support">
          {(props) => <SupportScreen onClose={() => props.navigation.goBack()} />}
        </Stack.Screen>
        <Stack.Screen
          name="ProductDetail"
          options={{ animation: 'slide_from_bottom' }}
        >
          {(props) => (
            <ProductDetailScreen
              handle={props.route.params.handle}
              onClose={() => props.navigation.goBack()}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/** Wrapper to adapt HomeScreen to navigation */
function HomeScreenWrapper({ navigation }: any) {
  return (
    <HomeScreen
      onNavigate={(screen) => {
        switch (screen) {
          case 'skywatch': navigation.navigate('SkyWatch'); break;
          case 'shop': navigation.navigate('Shop'); break;
          case 'support': navigation.navigate('Support'); break;
        }
      }}
      onProductSelect={(handle) => navigation.navigate('ProductDetail', { handle })}
    />
  );
}
