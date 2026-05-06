import { Ionicons } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { EasePressable } from '../components/EasePressable';
import { SpringPressable } from '../components/SpringPressable';
import { HomeScreen } from '../screens/HomeScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { PlansScreen } from '../screens/PlansScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ItemDetailScreen } from '../screens/ItemDetailScreen';
import { AddItemScreen } from '../screens/AddItemScreen';
import { InventoryGroupScreen } from '../screens/InventoryGroupScreen';
import { ScanEntryScreen } from '../screens/ScanEntryScreen';
import { LinkEntryScreen } from '../screens/LinkEntryScreen';
import { StaticInfoScreen } from '../screens/StaticInfoScreen';
import { DataExportScreen } from '../screens/DataExportScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import type { MainTabParamList, RootStackParamList } from './types';
import { InventoryBulkTabProvider, useInventoryBulkTab } from '../context/InventoryBulkTabContext';
import { TabScreenFadeIn } from '../components/TabScreenFadeIn';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_SCALE = 0.75;
/** 多选底部条：相对 TAB_SCALE 约 4/3（较「再放大 2 倍」版本缩为 2/3） */
const BULK_TAB_BAR_SCALE = TAB_SCALE * (4 / 3);

/** Tab 页与 Stack 子页通用：焦点出现时整体渐显，避免「整块瞬时替换」观感 */
function withFocusFade<P extends object>(
  Screen: React.ComponentType<P>,
  fadeDuration?: number
) {
  return function FocusFadeScreen(props: P) {
    return (
      <TabScreenFadeIn duration={fadeDuration}>
        <Screen {...props} />
      </TabScreenFadeIn>
    );
  };
}

/** 物品 / 计划 Tab：列表为主，略加长淡入更易感知 */
const INVENTORY_PLANS_TAB_FADE_MS = 520;
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  HomeTab: '首页',
  InventoryTab: '我的物品',
  PlansTab: '物品计划',
  ProfileTab: '我的',
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { payload } = useInventoryBulkTab();

  if (payload) {
    return (
      <View
        style={[
          styles.tabBarWrap,
          {
            paddingBottom: Math.max(insets.bottom, 8 * BULK_TAB_BAR_SCALE),
            paddingTop: 6 * BULK_TAB_BAR_SCALE,
          },
        ]}
      >
        <View style={styles.bulkTabRow}>
          <Text style={styles.bulkTabSummary} numberOfLines={1}>
            {payload.summary}
          </Text>
          <View style={styles.bulkTabIcons}>
            <EasePressable
              onPress={payload.onSelectAll}
              pressableStyle={styles.bulkTabIconBtn}
              style={styles.bulkTabIconBtn}
              shrink={0.88}
              accessibilityRole="button"
              accessibilityLabel={payload.allVisibleSelected ? '取消全选' : '全选'}
            >
              <Ionicons
                name={payload.allVisibleSelected ? 'checkbox' : 'checkbox-outline'}
                size={24 * BULK_TAB_BAR_SCALE}
                color={colors.text}
              />
            </EasePressable>
            {payload.showMove ? (
              <EasePressable
                onPress={payload.onMoveToGroup}
                pressableStyle={styles.bulkTabIconBtn}
                style={styles.bulkTabIconBtn}
                shrink={0.88}
                accessibilityRole="button"
                accessibilityLabel="移入分组"
              >
                <Ionicons name="folder-open-outline" size={24 * BULK_TAB_BAR_SCALE} color={colors.text} />
              </EasePressable>
            ) : null}
            <EasePressable
              onPress={payload.onDelete}
              pressableStyle={styles.bulkTabIconBtn}
              style={styles.bulkTabIconBtn}
              shrink={0.88}
              accessibilityRole="button"
              accessibilityLabel="删除"
            >
              <Ionicons name="trash-outline" size={24 * BULK_TAB_BAR_SCALE} color={colors.primary} />
            </EasePressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 10 * TAB_SCALE) }]}>
      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label = TAB_LABELS[route.name as keyof MainTabParamList];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <View key={route.key} style={styles.tabSlot}>
              <SpringPressable
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                style={styles.tabItem}
                shrink={0.96}
                hitSlop={{
                  top: 8,
                  bottom: 8,
                  left: 4,
                  right: 4,
                }}
              >
                <Text
                  style={[styles.tabLabel, isFocused ? styles.tabLabelActive : styles.tabLabelInactive]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </SpringPressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <InventoryBulkTabProvider>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen name="HomeTab" component={withFocusFade(HomeScreen)} />
        <Tab.Screen
          name="InventoryTab"
          component={withFocusFade(InventoryScreen, INVENTORY_PLANS_TAB_FADE_MS)}
        />
        <Tab.Screen name="PlansTab" component={withFocusFade(PlansScreen, INVENTORY_PLANS_TAB_FADE_MS)} />
        <Tab.Screen name="ProfileTab" component={withFocusFade(ProfileScreen)} />
      </Tab.Navigator>
    </InventoryBulkTabProvider>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <View style={styles.appRoot}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 340,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="InventoryGroup" component={withFocusFade(InventoryGroupScreen)} />
          <Stack.Screen name="ItemDetail" component={withFocusFade(ItemDetailScreen)} />
          <Stack.Screen
            name="AddItem"
            component={withFocusFade(AddItemScreen)}
            options={{
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
              animation: 'slide_from_bottom',
              animationDuration: 340,
            }}
          />
          <Stack.Screen
            name="ScanEntry"
            component={ScanEntryScreen}
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen
            name="LinkEntry"
            component={LinkEntryScreen}
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="AccountSettings" component={withFocusFade(StaticInfoScreen)} />
          <Stack.Screen name="DataExport" component={withFocusFade(DataExportScreen)} />
          <Stack.Screen name="About" component={withFocusFade(StaticInfoScreen)} />
          <Stack.Screen name="Help" component={withFocusFade(StaticInfoScreen)} />
          <Stack.Screen name="EditProfile" component={withFocusFade(EditProfileScreen)} />
        </Stack.Navigator>
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  tabBarWrap: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  tabSlot: {
    flex: 1,
    minWidth: 0,
  },
  tabItem: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 15,
    textAlign: 'center',
  },
  tabLabelInactive: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  tabLabelActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  bulkTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14 * BULK_TAB_BAR_SCALE,
    minHeight: 40 * BULK_TAB_BAR_SCALE,
    gap: 10 * BULK_TAB_BAR_SCALE,
  },
  bulkTabSummary: {
    flex: 1,
    fontSize: 14 * BULK_TAB_BAR_SCALE,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  bulkTabIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4 * BULK_TAB_BAR_SCALE,
    flexShrink: 0,
  },
  bulkTabIconBtn: {
    width: 44 * BULK_TAB_BAR_SCALE,
    height: 44 * BULK_TAB_BAR_SCALE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
