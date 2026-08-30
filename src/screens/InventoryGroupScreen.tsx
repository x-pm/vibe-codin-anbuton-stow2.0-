import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormSheetBackground } from '../components/FormSheetBackground';
import { SoftCircleThumb } from '../components/SoftCircleThumb';
import { SpringPressable } from '../components/SpringPressable';
import { useAppData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import type { InventoryItem } from '../types/models';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { itemDisplayGroup } from '../utils/itemGroup';
import { playNavTap } from '../services/sfx';
import {
  resolveItemStorageEquipment,
  resolveItemStorageRoom,
} from '../utils/itemStorageRoom';

type Route = RouteProp<RootStackParamList, 'InventoryGroup'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function InventoryGroupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { groupName, mode = 'group' } = route.params;
  const { items, rooms, storageEquipment } = useAppData();
  const { width } = useWindowDimensions();

  const gap = 12;
  const pad = 20;
  const colW = (width - pad * 2 - gap) / 2;

  const filtered = useMemo(() => {
    if (mode === 'room') {
      return items.filter((i) => resolveItemStorageRoom(i, rooms) === groupName);
    }
    if (mode === 'equipment') {
      return items.filter(
        (i) => resolveItemStorageEquipment(i, storageEquipment) === groupName
      );
    }
    return items.filter((i) => itemDisplayGroup(i) === groupName);
  }, [items, groupName, mode, rooms, storageEquipment]);

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <SpringPressable
      style={[styles.tile, { width: colW }]}
      onPress={() => {
        playNavTap();
        navigation.navigate('ItemDetail', { itemId: item.id });
      }}
      shrink={0.97}
    >
      <SoftCircleThumb uri={item.imageUri} size={colW} fadeTo={colors.blueLight} />
      <Text style={styles.tileMeta}>{item.codeLabel}</Text>
      <Text style={styles.tileGroup} numberOfLines={1}>
        {itemDisplayGroup(item)}
      </Text>
      <Text style={styles.tileName} numberOfLines={2}>
        {item.name}
      </Text>
    </SpringPressable>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <FormSheetBackground />
      <View style={styles.navRow}>
        <SpringPressable onPress={() => navigation.goBack()} style={styles.navIcon} shrink={0.9}>
          <Ionicons name="chevron-back" size={26} color={colors.textOnGlass} />
        </SpringPressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          {groupName}
        </Text>
        <View style={styles.navIcon} />
      </View>
        <Text style={styles.subtitle}>{filtered.length} 件物品</Text>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap, marginBottom: gap }}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {mode === 'room'
              ? '该房间下暂无物品'
              : mode === 'equipment'
                ? '该位置下暂无物品'
                : '该分组下暂无物品'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: colors.textOnGlass,
    marginHorizontal: 8,
  },
  subtitle: { fontSize: 13, color: colors.textOnGlassMuted, marginBottom: 8 },
  tile: {},
  tileMeta: { marginTop: 8, fontSize: 10, color: colors.textOnGlassMuted, letterSpacing: 0.5 },
  tileGroup: { marginTop: 4, fontSize: 11, fontFamily: fonts.semiBold, color: colors.primary },
  tileName: { marginTop: 2, fontSize: 15, fontFamily: fonts.bold, color: colors.textOnGlass },
  empty: { marginTop: 40, textAlign: 'center', fontSize: 15, color: colors.textOnGlassMuted },
});
