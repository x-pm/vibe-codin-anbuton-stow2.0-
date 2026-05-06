import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoodleCatInline } from '../components/DoodleCatInline';
import { EasePressable } from '../components/EasePressable';
import { HeaderBrandMark } from '../components/HeaderBrandMark';
import { HeaderMenuOutlineButton } from '../components/HeaderMenuOutlineButton';
import { InventoryLayersAnimatedIcon } from '../components/InventoryLayersAnimatedIcon';
import { InventorySearchAnimatedIcon } from '../components/InventorySearchAnimatedIcon';
import { SpringPressable } from '../components/SpringPressable';
import { useAppData } from '../context/DataContext';
import { useInventoryBulkTab } from '../context/InventoryBulkTabContext';
import { useTabWithStackNavigation, type TabWithStackNav } from '../navigation/hooks';
import type { InventoryItem } from '../types/models';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import { itemDisplayGroup } from '../utils/itemGroup';

type FilterKey = 'all' | 'group' | 'recent';

const SEARCH_FADE_DEBOUNCE_MS = 220;
const LIST_CONTENT_FADE_MS = 520;
const listFadeEase = Easing.out(Easing.cubic);

function InventoryFabCluster({
  bottom,
  navigation,
  hidden,
}: {
  bottom: number;
  navigation: TabWithStackNav;
  hidden?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const a0 = useRef(new Animated.Value(0)).current;
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      /** 自上而下依次弹出：上 → 中 → 紧贴主按钮；动效为自右下向左上抛入 */
      Animated.stagger(56, [
        Animated.spring(a2, { toValue: 1, friction: 6, tension: 165, useNativeDriver: true }),
        Animated.spring(a1, { toValue: 1, friction: 6, tension: 165, useNativeDriver: true }),
        Animated.spring(a0, { toValue: 1, friction: 6, tension: 165, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(a0, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(a1, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(a2, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [open, a0, a1, a2]);

  const runAndClose = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  /** 自屏幕右下方向左上方抛入落位 */
  const subStyle = (v: Animated.Value) => {
    const translateX = v.interpolate({
      inputRange: [0, 1],
      outputRange: [52, 0],
    });
    const translateY = v.interpolate({
      inputRange: [0, 1],
      outputRange: [64, 0],
    });
    const scale = v.interpolate({
      inputRange: [0, 1],
      outputRange: [0.45, 1],
    });
    return {
      opacity: v,
      transform: [{ translateX }, { translateY }, { scale }],
    };
  };

  /** 自上而下：手动录入 → 链接录入 → 扫描录入，主按钮在最下 */
  const subs = [
    {
      icon: 'create-outline' as const,
      onPress: () => runAndClose(() => navigation.navigate('AddItem', undefined)),
      anim: a2,
    },
    {
      icon: 'link-outline' as const,
      onPress: () => runAndClose(() => navigation.navigate('LinkEntry')),
      anim: a1,
    },
    {
      icon: 'camera-outline' as const,
      onPress: () => runAndClose(() => navigation.navigate('ScanEntry')),
      anim: a0,
    },
  ];

  if (hidden) return null;

  return (
    <>
      {open ? (
        <Pressable style={styles.fabBackdrop} onPress={() => setOpen(false)} accessibilityLabel="关闭菜单" />
      ) : null}
      <View style={[styles.fabCluster, { bottom }]} pointerEvents="box-none">
        <View style={styles.fabSubColumn}>
          {subs.map((s, idx) => (
            <Animated.View key={idx} style={subStyle(s.anim)}>
              <EasePressable
                pressableStyle={styles.subFabInner}
                style={styles.subFabInner}
                shrink={0.93}
                onPress={s.onPress}
                accessibilityRole="button"
                accessibilityLabel={
                  s.icon === 'camera-outline'
                    ? '扫描录入'
                    : s.icon === 'link-outline'
                      ? '链接录入'
                      : '手动录入'
                }
              >
                <Ionicons name={s.icon} size={22} color={colors.text} />
              </EasePressable>
            </Animated.View>
          ))}
        </View>
        <SpringPressable
          style={styles.fab}
          onPress={() => setOpen((o) => !o)}
          shrink={0.92}
          accessibilityRole="button"
          accessibilityLabel={open ? '关闭' : '添加'}
        >
          <Ionicons name={open ? 'close' : 'add'} size={open ? 28 : 32} color={colors.onPrimary} />
        </SpringPressable>
      </View>
    </>
  );
}

export function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useTabWithStackNavigation();
  const isFocused = useIsFocused();
  const { setPayload } = useInventoryBulkTab();
  const { width } = useWindowDimensions();
  const { items, groups, removeItemsByIds, moveItemsToGroup, removeGroupsByName } = useAppData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [moveModalVisible, setMoveModalVisible] = useState(false);

  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_FADE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const listContentOpacity = useRef(new Animated.Value(1)).current;
  const skipListFadeOnMount = useRef(true);
  useEffect(() => {
    if (skipListFadeOnMount.current) {
      skipListFadeOnMount.current = false;
      listContentOpacity.setValue(1);
      return;
    }
    listContentOpacity.setValue(0);
    const anim = Animated.timing(listContentOpacity, {
      toValue: 1,
      duration: LIST_CONTENT_FADE_MS,
      easing: listFadeEase,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [filter, debouncedQuery, listContentOpacity]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectedGroups([]);
  }, [filter]);

  const exitBulkMode = useCallback(() => {
    setBulkMode(false);
    setSelectedIds([]);
    setSelectedGroups([]);
  }, []);

  const toggleItemSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleGroupSelect = (name: string) => {
    setSelectedGroups((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };

  const gap = 12;
  const pad = 20;
  const colW = (width - pad * 2 - gap) / 2;

  const groupNames = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(itemDisplayGroup(i)));
    groups.forEach((g) => set.add(g));
    return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
  }, [items, groups]);

  const filteredGroupNames = useMemo(() => {
    if (!query.trim()) return groupNames;
    const q = query.trim().toLowerCase();
    return groupNames.filter((g) => g.toLowerCase().includes(q));
  }, [groupNames, query]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          itemDisplayGroup(i).toLowerCase().includes(q) ||
          (i.codeLabel && i.codeLabel.toLowerCase().includes(q))
      );
    }
    if (filter === 'all') {
      list = [...list].sort((a, b) => a.inventoryNumber - b.inventoryNumber);
    }
    if (filter === 'recent') {
      list = [...list];
    }
    return list;
  }, [items, query, filter]);

  const allVisibleSelected = useMemo(() => {
    if (filter === 'group') {
      const names = filteredGroupNames;
      return (
        names.length > 0 &&
        names.length === selectedGroups.length &&
        names.every((g) => selectedGroups.includes(g))
      );
    }
    const ids = filteredItems.map((i) => i.id);
    return (
      ids.length > 0 &&
      ids.length === selectedIds.length &&
      ids.every((id) => selectedIds.includes(id))
    );
  }, [filter, filteredGroupNames, filteredItems, selectedGroups, selectedIds]);

  const selectAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      if (filter === 'group') setSelectedGroups([]);
      else setSelectedIds([]);
      return;
    }
    if (filter === 'group') setSelectedGroups([...filteredGroupNames]);
    else setSelectedIds(filteredItems.map((i) => i.id));
  }, [allVisibleSelected, filter, filteredGroupNames, filteredItems]);

  const itemsInSelectedGroupsCount = useMemo(
    () =>
      filter === 'group'
        ? items.filter((i) => selectedGroups.includes(itemDisplayGroup(i))).length
        : 0,
    [items, selectedGroups, filter]
  );

  const confirmBulkDeleteItems = useCallback(() => {
    if (!selectedIds.length) return;
    Alert.alert('批量删除', `确定删除已选的 ${selectedIds.length} 件物品？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          removeItemsByIds(selectedIds);
          exitBulkMode();
        },
      },
    ]);
  }, [selectedIds, removeItemsByIds, exitBulkMode]);

  const confirmBulkDeleteGroups = useCallback(() => {
    if (!selectedGroups.length) return;
    const n = itemsInSelectedGroupsCount;
    Alert.alert(
      '批量删除分组',
      `将删除 ${selectedGroups.length} 个分组及其下全部物品（共 ${n} 件），是否继续？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            removeGroupsByName(selectedGroups);
            exitBulkMode();
          },
        },
      ]
    );
  }, [selectedGroups, itemsInSelectedGroupsCount, removeGroupsByName, exitBulkMode]);

  const handleBulkDelete = useCallback(() => {
    if (filter === 'group') {
      if (!selectedGroups.length) {
        Alert.alert('提示', '请先选择要删除的分组');
        return;
      }
      confirmBulkDeleteGroups();
      return;
    }
    if (!selectedIds.length) {
      Alert.alert('提示', '请先选择要删除的物品');
      return;
    }
    confirmBulkDeleteItems();
  }, [filter, selectedGroups, selectedIds, confirmBulkDeleteGroups, confirmBulkDeleteItems]);

  const openMoveToGroupModal = useCallback(() => {
    if (!selectedIds.length) return;
    setMoveModalVisible(true);
  }, [selectedIds]);

  useEffect(() => {
    if (!isFocused && bulkMode) {
      exitBulkMode();
    }
  }, [isFocused, bulkMode, exitBulkMode]);

  useEffect(() => {
    if (!bulkMode) {
      setPayload(null);
      return;
    }
    setPayload({
      summary:
        filter === 'group'
          ? `已选（${selectedGroups.length}）个分组`
          : `已选（${selectedIds.length}）件`,
      showMove: filter !== 'group',
      allVisibleSelected,
      onSelectAll: selectAllVisible,
      onMoveToGroup: openMoveToGroupModal,
      onDelete: handleBulkDelete,
    });
  }, [
    bulkMode,
    filter,
    selectedIds,
    selectedGroups,
    allVisibleSelected,
    selectAllVisible,
    openMoveToGroupModal,
    handleBulkDelete,
    setPayload,
  ]);

  useEffect(() => {
    return () => setPayload(null);
  }, [setPayload]);

  const applyMoveToGroup = (groupName: string) => {
    if (!selectedIds.length) return;
    moveItemsToGroup(selectedIds, groupName);
    setMoveModalVisible(false);
    setSelectedIds([]);
  };

  const renderGroupRow = ({ item: g }: { item: string }) => {
    const count = items.filter((i) => itemDisplayGroup(i) === g).length;
    const sel = selectedGroups.includes(g);
    return (
      <SpringPressable
        style={[styles.groupRow, bulkMode && styles.groupRowBulk]}
        onPress={() => {
          if (bulkMode) toggleGroupSelect(g);
          else navigation.navigate('InventoryGroup', { groupName: g });
        }}
        shrink={0.98}
      >
        <View style={styles.groupRowMain}>
          <Text style={styles.groupRowTitle}>{g}</Text>
          <Text style={styles.groupRowCount}>{count} 件</Text>
        </View>
        {bulkMode ? (
          <View style={[styles.checkBox, sel && styles.checkBoxOn]}>
            {sel ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        )}
      </SpringPressable>
    );
  };

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const sel = selectedIds.includes(item.id);
    return (
      <View style={[styles.tileWrap, { width: colW }]}>
        <SpringPressable
          style={[styles.tile, bulkMode && styles.tileBulk]}
          onPress={() => {
            if (bulkMode) toggleItemSelect(item.id);
            else navigation.navigate('ItemDetail', { itemId: item.id });
          }}
          shrink={0.97}
        >
          <View style={styles.tileImgWrap}>
            <Image
              source={{ uri: item.imageUri ?? 'https://picsum.photos/seed/placeholder/400/520' }}
              style={[styles.tileImg, bulkMode && styles.tileImgBulk]}
            />
            {bulkMode ? (
              <View style={styles.tileCheckWrap}>
                <View style={[styles.checkBox, sel && styles.checkBoxOn]}>
                  {sel ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
                </View>
              </View>
            ) : null}
          </View>
          <Text style={[styles.tileMeta, bulkMode && styles.tileTextBulk]}>{item.codeLabel}</Text>
          <Text style={[styles.tileGroup, bulkMode && styles.tileTextBulk]} numberOfLines={1}>
            {itemDisplayGroup(item)}
          </Text>
          <Text style={[styles.tileName, bulkMode && styles.tileTextBulk]} numberOfLines={2}>
            {item.name}
          </Text>
        </SpringPressable>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topRow}>
        <HeaderMenuOutlineButton />
        <Text style={styles.logo}>STOW</Text>
        <HeaderBrandMark onPress={() => navigation.navigate('ProfileTab')} />
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleRowLeft}>
          <InventoryLayersAnimatedIcon size={30} />
          <Text style={styles.title}>我的物品</Text>
        </View>
        <DoodleCatInline size={48} />
      </View>

      <View style={styles.searchWrap}>
        <InventorySearchAnimatedIcon size={18} />
        <TextInput
          placeholder="搜索库存物品..."
          placeholderTextColor={colors.textLight}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.tabsRow}>
        <View style={styles.tabs}>
          {(
            [
              { key: 'all' as const, label: '全部' },
              { key: 'group' as const, label: '按组查看' },
              { key: 'recent' as const, label: '近期添加' },
            ] as const
          ).map((t) => {
            const active = filter === t.key;
            return (
              <SpringPressable
                key={t.key}
                style={[styles.tabChip, active && styles.tabChipActive]}
                onPress={() => setFilter(t.key)}
                shrink={0.96}
              >
                <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{t.label}</Text>
              </SpringPressable>
            );
          })}
        </View>
        {bulkMode ? (
          <SpringPressable onPress={exitBulkMode} style={styles.tabGearBtn} shrink={0.95}>
            <Text style={styles.doneBulkText}>完成</Text>
          </SpringPressable>
        ) : (
          <SpringPressable
            onPress={() => setBulkMode(true)}
            style={styles.tabGearBtn}
            shrink={0.92}
            accessibilityLabel="批量管理"
          >
            <Ionicons name="cog-outline" size={22} color={colors.text} />
          </SpringPressable>
        )}
      </View>

      <Animated.View
        style={{ flex: 1, opacity: listContentOpacity }}
        needsOffscreenAlphaCompositing
      >
        {filter === 'group' ? (
          <FlatList
            key="inventory-list-by-group"
            data={filteredGroupNames}
            keyExtractor={(g) => g}
            contentContainerStyle={{
              paddingBottom: bulkMode ? 75 + insets.bottom : 120,
              paddingTop: 8,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={renderGroupRow}
            ItemSeparatorComponent={() => <View style={styles.groupSep} />}
          />
        ) : (
          <FlatList
            key="inventory-grid-items"
            data={filteredItems}
            keyExtractor={(i) => i.id}
            numColumns={2}
            columnWrapperStyle={{ gap, marginBottom: gap }}
            contentContainerStyle={{
              paddingBottom: bulkMode ? 75 + insets.bottom : 120,
              paddingTop: 8,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={renderItem}
          />
        )}
      </Animated.View>

      <InventoryFabCluster
        bottom={24 + insets.bottom}
        navigation={navigation}
        hidden={bulkMode}
      />

      <Modal visible={moveModalVisible} transparent animationType="fade">
        <Pressable style={styles.moveModalBackdrop} onPress={() => setMoveModalVisible(false)}>
          <Pressable
            style={[styles.moveModalCard, { paddingBottom: 24 + insets.bottom }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.moveModalTitle}>移入分组</Text>
            <ScrollView style={styles.moveModalList} keyboardShouldPersistTaps="handled">
              {groups.map((g) => (
                <SpringPressable
                  key={g}
                  style={styles.moveModalRow}
                  onPress={() => applyMoveToGroup(g)}
                  shrink={0.98}
                >
                  <Text style={styles.moveModalRowText}>{g}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </SpringPressable>
              ))}
            </ScrollView>
            <SpringPressable style={styles.moveModalCancel} onPress={() => setMoveModalVisible(false)} shrink={0.97}>
              <Text style={styles.moveModalCancelText}>取消</Text>
            </SpringPressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  logo: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: 3,
    color: colors.text,
  },
  titleRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    alignSelf: 'stretch',
  },
  titleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  title: { fontSize: 28, fontFamily: fonts.extraBold, color: colors.text },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 6,
  },
  tabGearBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  doneBulkText: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEEEEA',
    borderRadius: radius.surface,
    marginTop: 16,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  tabs: { flex: 1, flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  tabChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabChipText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.text },
  tabChipTextActive: { color: colors.onPrimary },
  tileWrap: { position: 'relative' },
  tile: {},
  tileBulk: { opacity: 0.52 },
  tileImgWrap: {
    position: 'relative',
    width: '100%',
    borderRadius: radius.surface,
    overflow: 'hidden',
  },
  tileImg: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: radius.surface,
    backgroundColor: colors.border,
  },
  tileImgBulk: { opacity: 0.55 },
  tileCheckWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 4,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: radius.surface,
    borderWidth: 2,
    borderColor: colors.textMuted,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  tileTextBulk: { opacity: 0.75 },
  tileMeta: { marginTop: 8, fontSize: 10, color: colors.textLight, letterSpacing: 0.5 },
  tileGroup: { marginTop: 4, fontSize: 11, fontFamily: fonts.semiBold, color: colors.primary },
  tileName: { marginTop: 2, fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  groupRowMain: { flex: 1 },
  groupRowTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  groupRowCount: { marginTop: 4, fontSize: 13, color: colors.textMuted },
  groupRowBulk: { opacity: 0.55 },
  groupSep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  moveModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  moveModalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.surface,
    borderTopRightRadius: radius.surface,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '55%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  moveModalTitle: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.text, marginBottom: 12 },
  moveModalList: { maxHeight: 280 },
  moveModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  moveModalRowText: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.text },
  moveModalCancel: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  moveModalCancelText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textMuted },
  fabBackdrop: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    zIndex: 40,
  },
  fabCluster: {
    position: 'absolute',
    right: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    zIndex: 41,
  },
  /** 三个录入按钮在主「+」左侧，自上而下排列 */
  fabSubColumn: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    marginRight: 12,
    gap: 10,
  },
  subFabInner: {
    width: 48,
    height: 48,
    borderRadius: radius.surface,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
