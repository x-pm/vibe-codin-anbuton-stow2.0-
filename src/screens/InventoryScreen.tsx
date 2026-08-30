import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
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
import { HeaderMenuOutlineButton } from '../components/HeaderMenuOutlineButton';
import { InventoryLayersAnimatedIcon } from '../components/InventoryLayersAnimatedIcon';
import { InventorySearchAnimatedIcon } from '../components/InventorySearchAnimatedIcon';
import { GlassSurface } from '../components/GlassSurface';
import { SoftCircleThumb } from '../components/SoftCircleThumb';
import { SpringPressable } from '../components/SpringPressable';
import { useRequireCloudLogin } from '../context/AuthContext';
import { useAppData } from '../context/DataContext';
import { useInventoryBulkTab } from '../context/InventoryBulkTabContext';
import { useTabWithStackNavigation, type TabWithStackNav } from '../navigation/hooks';
import type { InventoryItem } from '../types/models';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import { itemDisplayGroup } from '../utils/itemGroup';
import { dismissKeyboard, doneReturnKeyProps, searchReturnKeyProps } from '../utils/inputKeyboard';
import { playNavTap } from '../services/sfx';
import {
  resolveItemStorageEquipment,
  resolveItemStorageRoom,
  UNSET_STORAGE_EQUIPMENT,
  UNSET_STORAGE_ROOM,
} from '../utils/itemStorageRoom';
import {
  filterItemsByBroadSearch,
  filterItemsByItemKeyword,
  itemMatchesItemKeyword,
} from '../utils/inventorySearch';

/** 物品列表筛选/排序（括号内为内部含义） */
type InventoryViewMode =
  | 'default' // 默认：按编号从小到大
  | 'time_desc' // 按时间顺序：降序（新→旧）
  | 'time_asc' // 按时间顺序：升序（旧→新）
  | 'by_group' // 按物品分组
  | 'by_room' // 按房间（一级存储位置）
  | 'by_equipment'; // 按位置分组（二级储物设备）

const VIEW_MODE_OPTIONS: { key: InventoryViewMode; label: string }[] = [
  { key: 'default', label: '默认' },
  { key: 'time_desc', label: '按时间 · 新→旧' },
  { key: 'time_asc', label: '按时间 · 旧→新' },
  { key: 'by_group', label: '按物品分组' },
  { key: 'by_room', label: '按房间' },
  { key: 'by_equipment', label: '按位置分组' },
];

/** 底部导航栏内容区高度（不含安全区），用于把 + 按钮抬到导航上方 */
const MAIN_TAB_BAR_CONTENT_HEIGHT = 64;

function viewModeLabel(mode: InventoryViewMode): string {
  return VIEW_MODE_OPTIONS.find((o) => o.key === mode)?.label ?? '默认';
}

/** 录入 id 多为时间戳字符串，用作时间排序 */
function itemCreatedMs(item: InventoryItem): number {
  const n = Number(item.id);
  return Number.isFinite(n) ? n : 0;
}

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
  const requireCloudLogin = useRequireCloudLogin();
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
      onPress: () =>
        runAndClose(() => {
          playNavTap();
          requireCloudLogin(() => navigation.navigate('AddItem', undefined));
        }),
      anim: a2,
    },
    {
      icon: 'link-outline' as const,
      onPress: () =>
        runAndClose(() => {
          playNavTap();
          requireCloudLogin(() => navigation.navigate('LinkEntry'));
        }),
      anim: a1,
    },
    {
      icon: 'camera-outline' as const,
      onPress: () =>
        runAndClose(() => {
          playNavTap();
          requireCloudLogin(() => navigation.navigate('ScanEntry'));
        }),
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
                <GlassSurface pointerEvents="none" tint="surface" style={StyleSheet.absoluteFillObject} />
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
  const {
    items,
    groups,
    rooms,
    storageEquipment,
    addGroup,
    addRoom,
    removeItemsByIds,
    moveItemsToGroup,
    removeGroupsByName,
  } = useAppData();
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<InventoryViewMode>('default');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  /** 多选底栏「新建」：先选类型，再填名称 */
  const [createPickOpen, setCreatePickOpen] = useState(false);
  const [createNameKind, setCreateNameKind] = useState<'group' | 'location' | null>(null);
  const [createNameInput, setCreateNameInput] = useState('');

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
  }, [viewMode, debouncedQuery, listContentOpacity]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectedGroups([]);
  }, [viewMode]);

  const sectionListRef = useRef<FlatList<string>>(null);
  const itemsListRef = useRef<FlatList<InventoryItem>>(null);

  /** 切换筛选/排序后回到顶部，展示新顺序 */
  useEffect(() => {
    requestAnimationFrame(() => {
      sectionListRef.current?.scrollToOffset({ offset: 0, animated: false });
      itemsListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [viewMode]);

  const isSectionMode =
    viewMode === 'by_group' || viewMode === 'by_room' || viewMode === 'by_equipment';

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

  const roomNames = useMemo(() => {
    const names = [...rooms];
    const hasUnset = items.some((i) => resolveItemStorageRoom(i, rooms) === UNSET_STORAGE_ROOM);
    if (hasUnset) names.push(UNSET_STORAGE_ROOM);
    return names;
  }, [rooms, items]);

  const equipmentNames = useMemo(() => {
    const names = [...storageEquipment];
    const hasUnset = items.some(
      (i) => resolveItemStorageEquipment(i, storageEquipment) === UNSET_STORAGE_EQUIPMENT
    );
    if (hasUnset) names.push(UNSET_STORAGE_EQUIPMENT);
    return names;
  }, [storageEquipment, items]);

  const sectionNames = useMemo(() => {
    if (viewMode === 'by_group') {
      if (!query.trim()) return groupNames;
      const q = query.trim().toLowerCase();
      return groupNames.filter((g) => {
        if (g.toLowerCase().includes(q)) return true;
        return items.some(
          (i) => itemDisplayGroup(i) === g && itemMatchesItemKeyword(i, q)
        );
      });
    }
    if (viewMode === 'by_room') {
      if (!query.trim()) return roomNames;
      const q = query.trim().toLowerCase();
      return roomNames.filter((loc) => {
        if (loc.toLowerCase().includes(q)) return true;
        return items.some(
          (i) =>
            resolveItemStorageRoom(i, rooms) === loc && itemMatchesItemKeyword(i, q)
        );
      });
    }
    if (viewMode === 'by_equipment') {
      if (!query.trim()) return equipmentNames;
      const q = query.trim().toLowerCase();
      return equipmentNames.filter((eq) => {
        if (eq.toLowerCase().includes(q)) return true;
        return items.some(
          (i) =>
            resolveItemStorageEquipment(i, storageEquipment) === eq &&
            itemMatchesItemKeyword(i, q)
        );
      });
    }
    return groupNames;
  }, [viewMode, roomNames, equipmentNames, groupNames, query, items, rooms, storageEquipment]);

  const filteredItems = useMemo(() => {
    if (viewMode === 'default') {
      return filterItemsByBroadSearch(items, query, rooms).sort(
        (a, b) => a.inventoryNumber - b.inventoryNumber
      );
    }
    if (viewMode === 'time_desc') {
      return filterItemsByItemKeyword(items, query).sort(
        (a, b) => itemCreatedMs(b) - itemCreatedMs(a)
      );
    }
    if (viewMode === 'time_asc') {
      return filterItemsByItemKeyword(items, query).sort(
        (a, b) => itemCreatedMs(a) - itemCreatedMs(b)
      );
    }
    return items;
  }, [items, query, viewMode, rooms]);

  const allVisibleSelected = useMemo(() => {
    if (isSectionMode) {
      const names = sectionNames;
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
  }, [isSectionMode, sectionNames, filteredItems, selectedGroups, selectedIds]);

  const selectAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      if (isSectionMode) setSelectedGroups([]);
      else setSelectedIds([]);
      return;
    }
    if (isSectionMode) setSelectedGroups([...sectionNames]);
    else setSelectedIds(filteredItems.map((i) => i.id));
  }, [allVisibleSelected, isSectionMode, sectionNames, filteredItems]);

  const itemsInSelectedSectionsCount = useMemo(() => {
    if (!isSectionMode) return 0;
    if (viewMode === 'by_room') {
      return items.filter((i) =>
        selectedGroups.includes(resolveItemStorageRoom(i, rooms))
      ).length;
    }
    if (viewMode === 'by_equipment') {
      return items.filter((i) =>
        selectedGroups.includes(resolveItemStorageEquipment(i, storageEquipment))
      ).length;
    }
    return items.filter((i) => selectedGroups.includes(itemDisplayGroup(i))).length;
  }, [items, selectedGroups, isSectionMode, viewMode, rooms, storageEquipment]);

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
    const n = itemsInSelectedSectionsCount;
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
  }, [selectedGroups, itemsInSelectedSectionsCount, removeGroupsByName, exitBulkMode]);

  const confirmBulkDeleteByRoom = useCallback(() => {
    if (!selectedGroups.length) return;
    const ids = items
      .filter((i) => selectedGroups.includes(resolveItemStorageRoom(i, rooms)))
      .map((i) => i.id);
    const n = ids.length;
    Alert.alert(
      '批量删除',
      `将删除所选 ${selectedGroups.length} 个房间下的全部物品（共 ${n} 件），是否继续？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            removeItemsByIds(ids);
            exitBulkMode();
          },
        },
      ]
    );
  }, [selectedGroups, items, rooms, removeItemsByIds, exitBulkMode]);

  const confirmBulkDeleteByEquipment = useCallback(() => {
    if (!selectedGroups.length) return;
    const ids = items
      .filter((i) =>
        selectedGroups.includes(resolveItemStorageEquipment(i, storageEquipment))
      )
      .map((i) => i.id);
    const n = ids.length;
    Alert.alert(
      '批量删除',
      `将删除所选 ${selectedGroups.length} 个位置下的全部物品（共 ${n} 件），是否继续？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            removeItemsByIds(ids);
            exitBulkMode();
          },
        },
      ]
    );
  }, [selectedGroups, items, storageEquipment, removeItemsByIds, exitBulkMode]);

  const handleBulkDelete = useCallback(() => {
    if (viewMode === 'by_group') {
      if (!selectedGroups.length) {
        Alert.alert('提示', '请先选择要删除的分组');
        return;
      }
      confirmBulkDeleteGroups();
      return;
    }
    if (viewMode === 'by_room') {
      if (!selectedGroups.length) {
        Alert.alert('提示', '请先选择要删除的房间');
        return;
      }
      confirmBulkDeleteByRoom();
      return;
    }
    if (viewMode === 'by_equipment') {
      if (!selectedGroups.length) {
        Alert.alert('提示', '请先选择要删除的位置');
        return;
      }
      confirmBulkDeleteByEquipment();
      return;
    }
    if (!selectedIds.length) {
      Alert.alert('提示', '请先选择要删除的物品');
      return;
    }
    confirmBulkDeleteItems();
  }, [
    viewMode,
    selectedGroups,
    selectedIds,
    confirmBulkDeleteGroups,
    confirmBulkDeleteByRoom,
    confirmBulkDeleteByEquipment,
    confirmBulkDeleteItems,
  ]);

  const openMoveToGroupModal = useCallback(() => {
    if (!selectedIds.length) return;
    setMoveModalVisible(true);
  }, [selectedIds]);

  const openBulkCreate = useCallback(() => {
    setCreatePickOpen(true);
  }, []);

  const confirmCreateName = useCallback(() => {
    const t = createNameInput.trim();
    if (!t || !createNameKind) return;
    if (createNameKind === 'group') {
      addGroup(t);
    } else {
      if (t === UNSET_STORAGE_ROOM) {
        Alert.alert('提示', '该名称不可用，请换一个位置名');
        return;
      }
      addRoom(t);
    }
    setCreateNameInput('');
    setCreateNameKind(null);
  }, [createNameInput, createNameKind, addGroup, addRoom]);

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
      summary: isSectionMode
        ? viewMode === 'by_room'
          ? `已选（${selectedGroups.length}）个房间`
          : viewMode === 'by_equipment'
            ? `已选（${selectedGroups.length}）个位置`
            : `已选（${selectedGroups.length}）个分组`
        : `已选（${selectedIds.length}）件`,
      showMove: false,
      showCreate: true,
      allVisibleSelected,
      onSelectAll: selectAllVisible,
      onMoveToGroup: openMoveToGroupModal,
      onCreate: openBulkCreate,
      onDelete: handleBulkDelete,
    });
  }, [
    bulkMode,
    viewMode,
    isSectionMode,
    selectedIds,
    selectedGroups,
    allVisibleSelected,
    selectAllVisible,
    openMoveToGroupModal,
    openBulkCreate,
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

  const renderSectionRow = ({ item: g }: { item: string }) => {
    const count =
      viewMode === 'by_room'
        ? items.filter((i) => resolveItemStorageRoom(i, rooms) === g).length
        : viewMode === 'by_equipment'
          ? items.filter((i) => resolveItemStorageEquipment(i, storageEquipment) === g).length
          : items.filter((i) => itemDisplayGroup(i) === g).length;
    const groupMode: 'group' | 'room' | 'equipment' =
      viewMode === 'by_room'
        ? 'room'
        : viewMode === 'by_equipment'
          ? 'equipment'
          : 'group';
    const sel = selectedGroups.includes(g);
    return (
      <SpringPressable
        style={[styles.groupRow, bulkMode && styles.groupRowBulk]}
        onPress={() => {
          if (bulkMode) toggleGroupSelect(g);
          else {
            playNavTap();
            navigation.navigate('InventoryGroup', {
              groupName: g,
              mode: groupMode,
            });
          }
        }}
        onLongPress={() => {
          if (bulkMode) {
            toggleGroupSelect(g);
            return;
          }
          setBulkMode(true);
          setSelectedGroups((prev) => (prev.includes(g) ? prev : [...prev, g]));
        }}
        delayLongPress={320}
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
            else {
              playNavTap();
              navigation.navigate('ItemDetail', { itemId: item.id });
            }
          }}
          onLongPress={() => {
            if (bulkMode) {
              toggleItemSelect(item.id);
              return;
            }
            setBulkMode(true);
            setSelectedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
          }}
          delayLongPress={320}
          shrink={0.97}
        >
          <View style={[styles.tileImgWrap, bulkMode && styles.tileImgBulk]}>
            <SoftCircleThumb uri={item.imageUri} size={colW} fadeTo={colors.bgDeep} />
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
      <View style={styles.titleRow}>
        <View style={styles.titleRowLeft}>
          <HeaderMenuOutlineButton />
          <InventoryLayersAnimatedIcon size={30} />
          <Text style={styles.title}>我的物品</Text>
        </View>
        <DoodleCatInline size={48} />
      </View>

      <GlassSurface tint="search" style={styles.searchWrap}>
        <InventorySearchAnimatedIcon size={18} />
        <TextInput
          placeholder="搜搜我的物品……"
          placeholderTextColor={colors.textLight}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          {...searchReturnKeyProps}
          onSubmitEditing={dismissKeyboard}
        />
      </GlassSurface>

      <View style={styles.tabsRow}>
        {bulkMode ? (
          <SpringPressable
            style={styles.cancelBulkBtn}
            onPress={exitBulkMode}
            shrink={0.97}
            accessibilityRole="button"
            accessibilityLabel="取消多选"
          >
            <Text style={styles.cancelBulkText}>取消</Text>
          </SpringPressable>
        ) : (
          <SpringPressable
            style={styles.filterBtn}
            onPress={() => setFilterModalOpen(true)}
            shrink={0.97}
            accessibilityRole="button"
            accessibilityLabel={`筛选，当前${viewModeLabel(viewMode)}`}
          >
            <GlassSurface pointerEvents="none" tint="surface" style={StyleSheet.absoluteFillObject} />
            <Text style={styles.filterBtnLead}>筛选</Text>
            <Text style={styles.filterBtnText} numberOfLines={1}>
              {viewModeLabel(viewMode)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textOnGlassMuted} />
          </SpringPressable>
        )}
        {bulkMode ? (
          <SpringPressable
            onPress={exitBulkMode}
            style={styles.doneBulkBtn}
            shrink={0.95}
            accessibilityLabel="完成多选"
          >
            <Text style={styles.doneBulkText}>完成</Text>
          </SpringPressable>
        ) : (
          <SpringPressable
            onPress={() => setBulkMode(true)}
            style={styles.bulkActionBtn}
            shrink={0.95}
            accessibilityLabel="管理，批量操作"
          >
            <GlassSurface pointerEvents="none" tint="surface" style={StyleSheet.absoluteFillObject} />
            <Text style={styles.bulkActionBtnText}>管理</Text>
            <Ionicons name="cog-outline" size={18} color={colors.textOnGlass} />
          </SpringPressable>
        )}
      </View>

      <Animated.View
        style={{ flex: 1, opacity: listContentOpacity }}
        needsOffscreenAlphaCompositing
      >
        {isSectionMode ? (
          <FlatList
            ref={sectionListRef}
            key={`inventory-list-${viewMode}`}
            data={sectionNames}
            keyExtractor={(g) => g}
            contentContainerStyle={{
              paddingBottom: bulkMode
                ? 75 + insets.bottom
                : 24 + MAIN_TAB_BAR_CONTENT_HEIGHT + 72 + insets.bottom,
              paddingTop: 8,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={renderSectionRow}
            ItemSeparatorComponent={() => <View style={styles.groupSep} />}
          />
        ) : (
          <FlatList
            ref={itemsListRef}
            key={`inventory-grid-${viewMode}`}
            data={filteredItems}
            keyExtractor={(i) => i.id}
            numColumns={2}
            columnWrapperStyle={{ gap, marginBottom: gap }}
            contentContainerStyle={{
              paddingBottom: bulkMode
                ? 75 + insets.bottom
                : 24 + MAIN_TAB_BAR_CONTENT_HEIGHT + 72 + insets.bottom,
              paddingTop: 8,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={renderItem}
          />
        )}
      </Animated.View>

      <InventoryFabCluster
        bottom={16 + MAIN_TAB_BAR_CONTENT_HEIGHT + insets.bottom}
        navigation={navigation}
        hidden={bulkMode}
      />

      <Modal
        visible={filterModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <Pressable style={styles.filterModalBackdrop} onPress={() => setFilterModalOpen(false)}>
          <Pressable
            style={[styles.filterModalCard, { paddingBottom: 16 + insets.bottom }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.filterModalTitle}>筛选与排序</Text>
            {VIEW_MODE_OPTIONS.map((opt) => {
              const active = viewMode === opt.key;
              return (
                <SpringPressable
                  key={opt.key}
                  style={[styles.filterOptionRow, active && styles.filterOptionRowActive]}
                  onPress={() => {
                    setViewMode(opt.key);
                    setFilterModalOpen(false);
                  }}
                  shrink={0.98}
                >
                  <Text
                    style={[styles.filterOptionText, active && styles.filterOptionTextActive]}
                  >
                    {opt.label}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
                  ) : null}
                </SpringPressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

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
                  <Ionicons name="chevron-forward" size={18} color={colors.modalCardMuted} />
                </SpringPressable>
              ))}
            </ScrollView>
            <SpringPressable style={styles.moveModalCancel} onPress={() => setMoveModalVisible(false)} shrink={0.97}>
              <Text style={styles.moveModalCancelText}>取消</Text>
            </SpringPressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={createPickOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setCreatePickOpen(false)}
      >
        <Pressable style={styles.createModalBackdrop} onPress={() => setCreatePickOpen(false)}>
          <Pressable style={styles.createModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.moveModalTitle}>新建</Text>
            <SpringPressable
              style={styles.moveModalRow}
              onPress={() => {
                setCreatePickOpen(false);
                setCreateNameInput('');
                setCreateNameKind('group');
              }}
              shrink={0.98}
            >
              <Text style={styles.moveModalRowText}>新建分组</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.modalCardMuted} />
            </SpringPressable>
            <SpringPressable
              style={styles.moveModalRow}
              onPress={() => {
                setCreatePickOpen(false);
                setCreateNameInput('');
                setCreateNameKind('location');
              }}
              shrink={0.98}
            >
              <Text style={styles.moveModalRowText}>新建位置</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.modalCardMuted} />
            </SpringPressable>
            <SpringPressable
              style={styles.moveModalCancel}
              onPress={() => setCreatePickOpen(false)}
              shrink={0.97}
            >
              <Text style={styles.moveModalCancelText}>取消</Text>
            </SpringPressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={createNameKind != null}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setCreateNameKind(null)}
      >
        <Pressable style={styles.createModalBackdrop} onPress={() => setCreateNameKind(null)}>
          <Pressable style={styles.createModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.moveModalTitle}>
              {createNameKind === 'location' ? '新建位置' : '新建分组'}
            </Text>
            <View style={styles.createNameInputWrap}>
              <TextInput
                style={styles.createNameInput}
                placeholder={createNameKind === 'location' ? '位置名称' : '分组名称'}
                placeholderTextColor={colors.textLight}
                value={createNameInput}
                onChangeText={setCreateNameInput}
                autoFocus
                {...doneReturnKeyProps}
              />
            </View>
            <View style={styles.createNameActions}>
              <SpringPressable
                style={styles.createNameBtnGhost}
                onPress={() => setCreateNameKind(null)}
                shrink={0.96}
              >
                <Text style={styles.createNameBtnGhostText}>取消</Text>
              </SpringPressable>
              <SpringPressable style={styles.createNameBtnPrimary} onPress={confirmCreateName} shrink={0.96}>
                <Text style={styles.createNameBtnPrimaryText}>添加</Text>
              </SpringPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
  },
  titleRow: {
    marginBottom: 12,
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
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
    borderRadius: radius.surface,
  },
  filterBtnLead: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textOnGlass,
  },
  filterBtnText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textOnGlassMuted,
  },
  bulkActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: radius.surface,
  },
  bulkActionBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textOnGlass,
  },
  cancelBulkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.surface,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.22)',
  },
  cancelBulkText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textOnGlass,
  },
  doneBulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexShrink: 0,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
  },
  doneBulkText: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: colors.onPrimary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.surface,
    marginTop: 16,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.textOnGlass },
  filterModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  filterModalCard: {
    backgroundColor: colors.modalCardBg,
    paddingTop: 16,
    paddingHorizontal: 12,
    overflow: 'hidden',
    borderRadius: radius.surface,
  },
  filterModalTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: colors.modalCardText,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  filterOptionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58, 74, 90, 0.12)',
  },
  filterOptionRowActive: {
    backgroundColor: colors.primary,
  },
  filterOptionText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.modalCardText,
  },
  filterOptionTextActive: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
  },
  tileWrap: { position: 'relative' },
  tile: {},
  tileBulk: { opacity: 0.52 },
  tileImgWrap: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  moveModalCard: {
    backgroundColor: colors.modalCardBg,
    borderTopLeftRadius: radius.surface,
    borderTopRightRadius: radius.surface,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '55%',
    overflow: 'hidden',
  },
  /** 新建分组/位置：屏幕居中 */
  createModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  createModalCard: {
    backgroundColor: colors.modalCardBg,
    borderRadius: radius.surface,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  moveModalTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: colors.modalCardText,
    marginBottom: 12,
  },
  moveModalList: { maxHeight: 280 },
  moveModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(58, 74, 90, 0.12)',
  },
  moveModalRowText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.modalCardText,
  },
  moveModalCancel: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  moveModalCancelText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.modalCardMuted,
  },
  createNameInputWrap: {
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.18)',
    backgroundColor: '#fff',
    marginBottom: 18,
    overflow: 'hidden',
  },
  createNameInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.modalCardText,
  },
  createNameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  createNameBtnGhost: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.2)',
    backgroundColor: '#fff',
  },
  createNameBtnGhostText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.modalCardText,
  },
  createNameBtnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
  },
  createNameBtnPrimaryText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.onPrimary,
  },
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
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
