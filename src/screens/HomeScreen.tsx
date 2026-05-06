import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EasePressable } from '../components/EasePressable';
import { HeartPulseIconDecor } from '../components/HeartPulseIconDecor';
import { HomeDayNightIcon, isHomeSunlitWindow } from '../components/HomeDayNightIcon';
import { HomeEntryAnimatedIcon } from '../components/HomeEntryAnimatedIcon';
import { DoodleCatInline } from '../components/DoodleCatInline';
import { HeaderBrandMark } from '../components/HeaderBrandMark';
import { HeaderMenuOutlineButton } from '../components/HeaderMenuOutlineButton';
import { InventorySearchAnimatedIcon } from '../components/InventorySearchAnimatedIcon';
import { SpringPressable } from '../components/SpringPressable';
import { useAppData } from '../context/DataContext';
import { useTabWithStackNavigation } from '../navigation/hooks';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import type { InventoryItem, ItemPlan } from '../types/models';
import { getPlanThumbIcon, sortPendingPlansForPreview } from '../utils/planDisplay';
import { itemDisplayGroup } from '../utils/itemGroup';

const SLIDE_DOWN_PX = Math.min(220, Dimensions.get('window').height * 0.32);

function filterItemsForHomeSearch(items: InventoryItem[], query: string): InventoryItem[] {
  const t = query.trim().toLowerCase();
  let list = [...items];
  if (t) {
    list = list.filter(
      (i) =>
        i.name.toLowerCase().includes(t) ||
        i.category.toLowerCase().includes(t) ||
        itemDisplayGroup(i).toLowerCase().includes(t) ||
        (i.codeLabel && i.codeLabel.toLowerCase().includes(t)) ||
        (i.sku && i.sku.toLowerCase().includes(t)) ||
        (i.location && i.location.toLowerCase().includes(t))
    );
  }
  return list.sort((a, b) => a.inventoryNumber - b.inventoryNumber);
}

/** 与 `greetingTitleRow` 的 `gap` 一致，副标题左缩进 = 图标占位 + gap，与「下午好」标题对齐 */
const GREETING_ICON_TITLE_GAP = 10;

/** 首页未完成计划预览：点右侧圆圈 → 灰字删除线 + 圆内对钩渐显 → 向下滑出淡出并标记完成 */
function HomePlanPreviewRow({
  plan,
  onComplete,
}: {
  plan: ItemPlan;
  onComplete: (id: string) => void;
}) {
  const navigation = useTabWithStackNavigation();
  const ty = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const fadeGray = useRef(new Animated.Value(0)).current;
  const animating = useRef(false);

  const baseOpacity = fadeGray.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const doneOpacity = fadeGray.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const iconDim = fadeGray.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.5],
  });

  const thumb = getPlanThumbIcon(plan);

  const handleCirclePress = useCallback(() => {
    if (animating.current) return;
    animating.current = true;
    Animated.sequence([
      Animated.timing(fadeGray, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(ty, {
          toValue: SLIDE_DOWN_PX,
          duration: 340,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 340,
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      animating.current = false;
      if (finished) onComplete(plan.id);
    });
  }, [cardOpacity, fadeGray, onComplete, plan.id, ty]);

  return (
    <Animated.View
      style={[
        styles.planRow,
        {
          opacity: cardOpacity,
          transform: [{ translateY: ty }],
        },
      ]}
    >
      <EasePressable
        pressableStyle={styles.planRowPressable}
        style={styles.planRowPressable}
        shrink={0.99}
        onPress={() => navigation.navigate('PlansTab')}
      >
        <Animated.View
          style={[styles.planIconBox, { backgroundColor: thumb.boxBg }, { opacity: iconDim }]}
        >
          <Ionicons name={thumb.name} size={22} color={thumb.color} />
        </Animated.View>
        <View style={styles.planTextCol}>
          <View style={styles.planTitleStack}>
            <Animated.Text style={[styles.planTitle, { opacity: baseOpacity }]} numberOfLines={2}>
              {plan.title}
            </Animated.Text>
            <Animated.Text
              style={[styles.planTitle, styles.planTitleDoneOverlay, { opacity: doneOpacity }]}
              numberOfLines={2}
            >
              {plan.title}
            </Animated.Text>
          </View>
          <View style={styles.planDetailStack}>
            <Animated.Text
              style={[
                styles.planDetail,
                plan.accent === 'danger' && styles.planDetailDanger,
                { opacity: baseOpacity },
              ]}
              numberOfLines={3}
            >
              {plan.detail}
            </Animated.Text>
            <Animated.Text
              style={[styles.planDetail, styles.planDetailDoneOverlay, { opacity: doneOpacity }]}
              numberOfLines={3}
            >
              {plan.detail}
            </Animated.Text>
          </View>
        </View>
      </EasePressable>
      <EasePressable
        pressableStyle={styles.planCompleteHit}
        style={styles.planCompleteHit}
        shrink={0.92}
        onPress={handleCirclePress}
        accessibilityRole="button"
        accessibilityLabel="标记为已完成"
        hitSlop={8}
      >
        <View style={styles.planCompleteCircle}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.planCircleFill,
              {
                opacity: fadeGray,
                transform: [
                  {
                    scale: fadeGray.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="checkmark" size={12} color={colors.textMuted} />
          </Animated.View>
        </View>
      </EasePressable>
    </Animated.View>
  );
}

/** 按本地时间切换问候；「下午好」与太阳时段一致（含 18:00 整分） */
function getHomeGreeting(now = new Date()): string {
  const h = now.getHours();
  if (h >= 8 && h < 12) return '早安，馆藏家';
  if (h >= 12 && h < 14) return '中午好，馆藏家';
  if (h >= 14 && isHomeSunlitWindow(now)) return '下午好，馆藏家';
  return '晚安，馆藏家';
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const navigation = useTabWithStackNavigation();
  const { plans, totalCount, completePlan, items } = useAppData();
  const [homeClock, setHomeClock] = useState(() => new Date());
  const greeting = useMemo(() => getHomeGreeting(homeClock), [homeClock]);
  const [planSortAnchor, setPlanSortAnchor] = useState(() => new Date());

  /** 首页内联搜索：展开输入框，输入过程中不打开结果浮层 */
  const [homeSearchInlineOpen, setHomeSearchInlineOpen] = useState(false);
  const [homeSearchDraft, setHomeSearchDraft] = useState('');
  /** 用户确认搜索后写入，仅用于结果浮层内的列表筛选 */
  const [homeSearchCommittedQuery, setHomeSearchCommittedQuery] = useState('');
  const [homeSearchOpen, setHomeSearchOpen] = useState(false);
  /** 结果浮层顶缘：与首页「搜索已有物品」条下缘对齐（窗口坐标） */
  const [homeSearchModalTop, setHomeSearchModalTop] = useState(0);
  const homeInlineSearchRef = useRef<TextInput>(null);
  const homeSearchBarAnchorRef = useRef<View>(null);
  /** 浮层自下而上滑入的位移量，与当前测得的浮层可视高度一致 */
  const homeSearchSheetTravelRef = useRef(winH);
  const homeSearchBackdropOp = useRef(new Animated.Value(0)).current;
  const homeSearchSheetY = useRef(new Animated.Value(winH)).current;
  const homeSearchAnimating = useRef(false);

  const bottomPad = Math.max(insets.bottom, 10);

  const homeSearchFiltered = useMemo(
    () => filterItemsForHomeSearch(items, homeSearchCommittedQuery),
    [items, homeSearchCommittedQuery]
  );

  const openHomeSearchResultsModal = useCallback(() => {
    if (homeSearchOpen) return;
    if (homeSearchAnimating.current) return;

    const startAnim = (top: number, travel: number) => {
      homeSearchSheetTravelRef.current = travel;
      setHomeSearchModalTop(top);
      homeSearchAnimating.current = true;
      setHomeSearchOpen(true);
      homeSearchBackdropOp.setValue(0);
      homeSearchSheetY.setValue(travel);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(homeSearchBackdropOp, {
            toValue: 0.5,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(homeSearchSheetY, {
            toValue: 0,
            friction: 8,
            tension: 68,
            useNativeDriver: true,
          }),
        ]).start(() => {
          homeSearchAnimating.current = false;
        });
      });
    };

    const measureAndOpen = () => {
      const node = homeSearchBarAnchorRef.current;
      const minSheet = 200;
      const fallbackTop = Math.min(Math.max(insets.top + 8 + 44 + 12 + 12 + 80 + 12 + 52, 160), winH - minSheet);

      if (!node) {
        const travel = Math.max(winH - fallbackTop - bottomPad, minSheet);
        startAnim(fallbackTop, travel);
        return;
      }
      node.measureInWindow((x, y, w, h) => {
        let top = y + h;
        top = Math.min(top, winH - minSheet);
        top = Math.max(0, top);
        const travel = Math.max(winH - top - bottomPad, minSheet);
        startAnim(top, travel);
      });
    };

    // 收起内联搜索后布局再测，双 rAF 更稳
    requestAnimationFrame(() => {
      requestAnimationFrame(measureAndOpen);
    });
  }, [homeSearchOpen, homeSearchBackdropOp, homeSearchSheetY, winH, bottomPad, insets.top]);

  const submitHomeSearchFromInline = useCallback(() => {
    const q = homeSearchDraft.trim();
    if (!q) return;
    setHomeSearchCommittedQuery(q);
    homeInlineSearchRef.current?.blur();
    setHomeSearchInlineOpen(false);
    openHomeSearchResultsModal();
  }, [homeSearchDraft, openHomeSearchResultsModal]);

  const closeHomeSearch = useCallback(() => {
    if (!homeSearchOpen) return;
    homeSearchAnimating.current = true;
    Animated.parallel([
      Animated.timing(homeSearchBackdropOp, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(homeSearchSheetY, {
        toValue: homeSearchSheetTravelRef.current,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      homeSearchAnimating.current = false;
      if (finished) {
        setHomeSearchOpen(false);
        setHomeSearchCommittedQuery('');
      }
    });
  }, [homeSearchOpen, homeSearchBackdropOp, homeSearchSheetY]);

  const dismissSearchOpenItemDetail = useCallback(
    (itemId: string) => {
      homeSearchAnimating.current = false;
      homeSearchBackdropOp.setValue(0);
      homeSearchSheetY.setValue(homeSearchSheetTravelRef.current);
      setHomeSearchOpen(false);
      setHomeSearchCommittedQuery('');
      navigation.navigate('ItemDetail', { itemId });
    },
    [navigation, homeSearchBackdropOp, homeSearchSheetY]
  );

  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      setPlanSortAnchor(now);
      setHomeClock(now);
      return () => {
        homeSearchBackdropOp.setValue(0);
        homeSearchSheetY.setValue(winH);
        setHomeSearchOpen(false);
        setHomeSearchCommittedQuery('');
        setHomeSearchDraft('');
        setHomeSearchInlineOpen(false);
      };
    }, [homeSearchBackdropOp, homeSearchSheetY, winH])
  );

  useEffect(() => {
    const id = setInterval(() => setHomeClock(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const homePreviewPlans = useMemo(
    () =>
      sortPendingPlansForPreview(
        plans.filter((p) => !p.completed),
        planSortAnchor
      ).slice(0, 2),
    [plans, planSortAnchor]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topRow}>
        <HeaderMenuOutlineButton />
        <Text style={styles.logo}>STOW</Text>
        <HeaderBrandMark onPress={() => navigation.navigate('ProfileTab')} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingRow}>
          <View style={styles.greetingTextBlock}>
            <View style={styles.greetingTitleRow}>
              <HomeDayNightIcon at={homeClock} />
              <Text style={styles.greeting}>{greeting}</Text>
            </View>
          </View>
          <DoodleCatInline size={48} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardTextCol}>
              <Text style={styles.cardLabel}>总收录</Text>
              <Text style={styles.cardStat} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {totalCount} 件物品
              </Text>
            </View>
            <View style={styles.cardIconCol}>
              <HeartPulseIconDecor size={44} />
            </View>
          </View>
        </View>

        <View ref={homeSearchBarAnchorRef} collapsable={false}>
          {homeSearchInlineOpen ? (
            <View style={styles.homeSearchWrap}>
              <InventorySearchAnimatedIcon size={20} />
              <TextInput
                ref={homeInlineSearchRef}
                style={styles.homeSearchInlineInput}
                placeholder="搜索已有物品……"
                placeholderTextColor={colors.textLight}
                value={homeSearchDraft}
                onChangeText={setHomeSearchDraft}
                returnKeyType="search"
                onSubmitEditing={submitHomeSearchFromInline}
                blurOnSubmit
                accessibilityLabel="搜索已有物品"
              />
              <Pressable
                onPress={() => {
                  homeInlineSearchRef.current?.blur();
                  setHomeSearchInlineOpen(false);
                  setHomeSearchDraft('');
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="取消搜索"
              >
                <Ionicons name="close-circle" size={22} color={colors.textLight} />
              </Pressable>
            </View>
          ) : (
            <SpringPressable
              onPress={() => {
                setHomeSearchInlineOpen(true);
                requestAnimationFrame(() => homeInlineSearchRef.current?.focus());
              }}
              style={styles.homeSearchWrap}
              shrink={0.99}
              accessibilityRole="button"
              accessibilityLabel="搜索已有物品"
            >
              <InventorySearchAnimatedIcon size={20} />
              <Text style={styles.homeSearchPlaceholder}>搜索已有物品……</Text>
            </SpringPressable>
          )}
        </View>

        <View style={styles.actionsRow}>
          <View style={styles.actionTileShell}>
            <SpringPressable
              pressableStyle={StyleSheet.absoluteFillObject}
              style={[StyleSheet.absoluteFillObject, styles.actionTileFace, styles.actionPrimary]}
              onPress={() => navigation.navigate('ScanEntry')}
              shrink={0.96}
            >
              <HomeEntryAnimatedIcon variant="scan" />
              <Text style={styles.actionTileCaptionOnDark}>扫描录入</Text>
            </SpringPressable>
          </View>
          <View style={styles.actionTileShell}>
            <SpringPressable
              pressableStyle={StyleSheet.absoluteFillObject}
              style={[StyleSheet.absoluteFillObject, styles.actionTileFace, styles.actionOutline]}
              onPress={() => navigation.navigate('LinkEntry')}
              shrink={0.96}
            >
              <HomeEntryAnimatedIcon variant="link" />
              <Text style={styles.actionTileCaptionOnLight}>链接录入</Text>
            </SpringPressable>
          </View>
        </View>

        <View style={styles.actionManualShell}>
          <SpringPressable
            pressableStyle={StyleSheet.absoluteFillObject}
            style={[StyleSheet.absoluteFillObject, styles.actionManualFace, styles.actionOutline]}
            onPress={() => navigation.navigate('AddItem', undefined)}
            shrink={0.98}
          >
            <HomeEntryAnimatedIcon variant="manual" />
            <Text style={styles.actionManualCaption}>手动录入</Text>
          </SpringPressable>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>物品计划</Text>
          <SpringPressable
            onPress={() => navigation.navigate('PlansTab')}
            style={styles.sectionChevronBtn}
            shrink={0.92}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </SpringPressable>
        </View>

        <View style={styles.planPreviewClip}>
          {homePreviewPlans.map((p) => (
            <HomePlanPreviewRow key={p.id} plan={p} onComplete={completePlan} />
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={homeSearchOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={closeHomeSearch}
      >
        <View style={styles.homeSearchModalRoot}>
          <Animated.View
            pointerEvents="none"
            style={[styles.homeSearchModalDim, { opacity: homeSearchBackdropOp }]}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeHomeSearch} accessibilityLabel="关闭搜索" />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[
              styles.homeSearchModalKav,
              {
                top: homeSearchModalTop,
                paddingBottom: bottomPad,
              },
            ]}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[
                styles.homeSearchSheet,
                {
                  flex: 1,
                  minHeight: 0,
                  transform: [{ translateY: homeSearchSheetY }],
                },
              ]}
            >
              <Pressable style={styles.homeSearchSheetPressInner} onPress={(e) => e.stopPropagation()}>
                <View style={styles.homeSearchHandle} />
                <View style={styles.homeSearchSheetSearchRow}>
                  <InventorySearchAnimatedIcon size={20} />
                  <Text style={styles.homeSearchSheetQueryText} numberOfLines={2}>
                    {homeSearchCommittedQuery ? `「${homeSearchCommittedQuery}」` : ''}
                  </Text>
                  <SpringPressable onPress={closeHomeSearch} shrink={0.92} accessibilityLabel="关闭">
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </SpringPressable>
                </View>
                <Text style={styles.homeSearchSheetHint}>
                  {homeSearchFiltered.length} 件匹配
                </Text>
                <FlatList
                  data={homeSearchFiltered}
                  keyExtractor={(it) => it.id}
                  keyboardShouldPersistTaps="handled"
                  style={styles.homeSearchList}
                  contentContainerStyle={styles.homeSearchListContent}
                  renderItem={({ item }) => (
                    <SpringPressable
                      style={styles.homeSearchRow}
                      onPress={() => dismissSearchOpenItemDetail(item.id)}
                      shrink={0.98}
                    >
                      <Image
                        source={{
                          uri: item.imageUri ?? 'https://picsum.photos/seed/home-search/120/120',
                        }}
                        style={styles.homeSearchThumb}
                      />
                      <View style={styles.homeSearchRowText}>
                        <Text style={styles.homeSearchRowName} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.homeSearchRowMeta} numberOfLines={1}>
                          {item.codeLabel ? `编号 ${item.codeLabel}` : '无编号'}
                          {' · '}
                          {itemDisplayGroup(item)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                    </SpringPressable>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.homeSearchEmpty}>主人，您的仓库中还没有这个物品哦</Text>
                  }
                />
              </Pressable>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
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
    marginBottom: 10,
  },
  logo: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: 3,
    color: colors.text,
  },
  scroll: { paddingBottom: 28 },
  greetingRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  greetingTextBlock: { flex: 1, minWidth: 0 },
  greetingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GREETING_ICON_TITLE_GAP,
    flexWrap: 'wrap',
  },
  greeting: {
    flexShrink: 1,
    fontSize: 26,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  card: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTextCol: { flex: 1, minWidth: 0, overflow: 'hidden', zIndex: 0 },
  cardIconCol: {
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
    zIndex: 1,
    minWidth: 52,
  },
  cardLabel: { fontSize: 11, color: colors.textMuted, letterSpacing: 1 },
  cardStat: {
    marginTop: 8,
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  homeSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEEEEA',
    borderRadius: radius.surface,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  homeSearchPlaceholder: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textLight,
  },
  homeSearchInlineInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.text,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
  },
  homeSearchModalRoot: {
    flex: 1,
  },
  homeSearchModalDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  /** 顶缘由 `homeSearchModalTop` 对齐首页搜索条下缘，底缘贴屏 */
  homeSearchModalKav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  homeSearchSheet: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  homeSearchSheetPressInner: {
    flex: 1,
    minHeight: 0,
  },
  homeSearchHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  homeSearchSheetSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEEEEA',
    borderRadius: radius.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  homeSearchSheetQueryText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  homeSearchSheetHint: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  homeSearchList: {
    flex: 1,
    minHeight: 0,
  },
  homeSearchListContent: { paddingBottom: 8 },
  homeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  homeSearchThumb: {
    width: 52,
    height: 52,
    borderRadius: radius.surface,
    backgroundColor: colors.border,
  },
  homeSearchRowText: { flex: 1, minWidth: 0 },
  homeSearchRowName: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.text },
  homeSearchRowMeta: { marginTop: 4, fontSize: 13, color: colors.textMuted, fontFamily: fonts.regular },
  homeSearchEmpty: {
    textAlign: 'center',
    paddingVertical: 28,
    fontSize: 15,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  /** 仅首页：外框定宽/比例，不改动全局 SpringPressable */
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    width: '100%',
    alignSelf: 'stretch',
  },
  /** 上排单格：宽度为行 1/2，高度随宽度 1:1（与参考图「略方」一致） */
  actionTileShell: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
  },
  /** 与 absoluteFill 叠加：图标在上、文案在下、整体垂直居中 */
  actionTileFace: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderRadius: radius.square,
    gap: 12,
  },
  actionPrimary: {
    backgroundColor: colors.primary,
  },
  actionOutline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  /** 下排：全宽扁条，图标与「手动录入」并排、成组水平垂直居中（与参考稿一致） */
  actionManualShell: {
    width: '100%',
    marginTop: 8,
    height: 52,
    alignSelf: 'stretch',
  },
  actionManualFace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: radius.square,
    gap: 6,
  },
  actionManualCaption: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    lineHeight: 19,
    flexShrink: 0,
    ...Platform.select({
      android: { includeFontPadding: false },
    }),
  },
  actionTileCaptionOnDark: {
    color: colors.onPrimary,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    textAlign: 'center',
    alignSelf: 'stretch',
    lineHeight: 19,
    ...Platform.select({
      android: { includeFontPadding: false },
    }),
  },
  actionTileCaptionOnLight: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    textAlign: 'center',
    alignSelf: 'stretch',
    lineHeight: 19,
    ...Platform.select({
      android: { includeFontPadding: false },
    }),
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  /** 与下方计划名片右侧箭头一致，点击进入「物品计划」Tab */
  sectionChevronBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planPreviewClip: {
    overflow: 'hidden',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  planRowPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  planCompleteHit: {
    paddingLeft: 6,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planCompleteCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.textLight,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  planCircleFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 11,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitleStack: {
    position: 'relative',
    alignSelf: 'stretch',
    minHeight: 22,
  },
  planDetailStack: {
    position: 'relative',
    alignSelf: 'stretch',
    marginTop: 4,
    minHeight: 20,
  },
  planTitleDoneOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    color: colors.textLight,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.textLight,
  },
  planDetailDoneOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    color: colors.textLight,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.textLight,
  },
  planIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTextCol: { flex: 1 },
  planTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  planDetail: { fontSize: 13, color: colors.textMuted },
  planDetailDanger: { color: colors.danger },
});
