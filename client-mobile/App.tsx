// FILE: /video-platform/client-mobile/App.tsx
/**
 * 功能说明：
 * - Expo 应用入口，配置导航与页面。
 * - 使用 Tab 导航 + Stack 导航
 */

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";

// Screens
import LoginScreen from "./screens/LoginScreen";
import PlayerScreen from "./screens/PlayerScreen";
import HomeScreen from "./screens/HomeScreen";
import LiveViewScreen from "./screens/LiveViewScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab 图标
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const icons: Record<string, string> = {
    Home: '🏠',
    Live: '📺',
    Profile: '👤',
  };
  return <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>{icons[name] || '📱'}</Text>;
};

// 主 Tab 导航
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#9333ea',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
        },
        headerStyle: { backgroundColor: '#1a1a1a' },
        headerTintColor: '#fff',
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: '首页' }}
      />
      <Tab.Screen
        name="Live"
        component={LiveListPlaceholder}
        options={{ title: '直播' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfilePlaceholder}
        options={{ title: '我的' }}
      />
    </Tab.Navigator>
  );
}

// 占位页面
function LiveListPlaceholder() {
  return <Text style={{ flex: 1, color: '#fff', textAlign: 'center', marginTop: 50 }}>直播列表</Text>;
}

function ProfilePlaceholder() {
  return <Text style={{ flex: 1, color: '#fff', textAlign: 'center', marginTop: 50 }}>个人中心</Text>;
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a1a' },
          headerTintColor: '#fff',
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{ title: '视频播放' }}
        />
        <Stack.Screen
          name="LiveView"
          component={LiveViewScreen}
          options={{ title: '直播间' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}