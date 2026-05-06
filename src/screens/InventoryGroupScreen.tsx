import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { FlatList, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpringPressable } from '../components/SpringPressable';
import { useAppData } from '../context/DataContext';
import type { RootStackParamList } from '../navigation/types';
import type { InventoryItem } from '../types/models';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import { itemDisplayGroup } from '../utils/itemGroup';

type Route = RouteProp<RootStackParamList, 'InventoryGroup'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function InventoryGroupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { groupName } = route.params;
  const { items } = useAppData();
  const { width } = useWindowDimensions();

  const gap = 12;
  const pad = 20;
  const colW = (width - pad * 2 - gap) / 2;

  const filtered = useMemo(
    () => items.filter((i) => itemDisplayGroup(i) === groupName),
    [items, groupName]
  );

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <SpringPressable
      style={[styles.tile, { width: colW }]}
      onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
      shrink={0.97}
    >
      <Image
        source={{ uri: item.imageUri ?? 'https://picsum.photos/seed/placeholder/400/520' }}
        style={styles.tileImg}
      />
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
      <View style={styles.navRow}>
        <SpringPressable onPress={() => navigation.goBack()} style={styles.navIcon} shrink={0.9}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
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
          <Text style={styles.empty}>该分组下暂无物品</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
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
    color: colors.text,
    marginHorizontal: 8,
  },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  tile: {},
  tileImg: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: radius.surface,
    backgroundColor: colors.border,
  },
  tileMeta: { marginTop: 8, fontSize: 10, color: colors.textLight, letterSpacing: 0.5 },
  tileGroup: { marginTop: 4, fontSize: 11, fontFamily: fonts.semiBold, color: colors.primary },
  tileName: { marginTop: 2, fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  empty: { marginTop: 40, textAlign: 'center', fontSize: 15, color: colors.textMuted },
});
