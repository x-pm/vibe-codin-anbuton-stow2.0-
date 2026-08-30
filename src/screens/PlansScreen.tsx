import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoodleCatInline } from '../components/DoodleCatInline';
import { PlanDatePickerPanel } from '../components/PlanDatePickerPanel';
import { EasePressable } from '../components/EasePressable';
import { GlassSurface } from '../components/GlassSurface';
import { HeaderMenuOutlineButton } from '../components/HeaderMenuOutlineButton';
import { PlansBellAnimatedIcon } from '../components/PlansBellAnimatedIcon';
import { SpringPressable } from '../components/SpringPressable';
import { useAppData } from '../context/DataContext';
import { useInventoryBulkTab } from '../context/InventoryBulkTabContext';
import { useTabWithStackNavigation } from '../navigation/hooks';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius } from '../theme/radius';
import type { ItemPlan } from '../types/models';
import { formatISODate, formatPlanCardDate } from '../utils/planDates';
import { getPlanThumbIcon, sortPendingPlansForPreview } from '../utils/planDisplay';
import { doneReturnKeyProps } from '../utils/inputKeyboard';
import { playPlanComplete, playSaveSuccess } from '../services/sfx';

const SLIDE_DOWN_PX = Math.min(300, Dimensions.get('window').height * 0.38);

type PlansTaskCardProps = {
  plan: ItemPlan;
  bulkMode: boolean;
  selectedIds: string[];
  togglePlanSelect: (id: string) => void;
  completePlan: (id: string) => void;
  /** 长按进入多选并选中该项 */
  enterBulkWithPlan: (id: string) => void;
  /** 点击卡片进入明细（与新建同一表单） */
  onOpenDetail: (plan: ItemPlan) => void;
};

/** 未完成：点圆圈 → 灰字删除线 → 向下滑出淡出 → 标记完成（已完成项仍为静态灰字样式） */
function PlansTaskCard({
  plan,
  bulkMode,
  selectedIds,
  togglePlanSelect,
  completePlan,
  enterBulkWithPlan,
  onOpenDetail,
}: PlansTaskCardProps) {
  const done = !!plan.completed;
  const sel = selectedIds.includes(plan.id);
  const thumb = getPlanThumbIcon(plan);

  const fadeGray = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
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
    outputRange: [1, 0.35],
  });

  const handleComplete = useCallback(() => {
    if (done || bulkMode || animating.current) return;
    animating.current = true;
    playPlanComplete();
    Animated.sequence([
      Animated.timing(fadeGray, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(ty, {
          toValue: SLIDE_DOWN_PX,
          duration: 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      animating.current = false;
      if (finished) completePlan(plan.id);
    });
  }, [bulkMode, cardOpacity, completePlan, done, fadeGray, plan.id, ty]);

  const dateLabel = formatPlanCardDate(plan);

  /** 与普通模式相同布局：标题 + 类型标签；有日期时靠右显示 */
  const mainInnerStatic = (d: boolean) => (
    <>
      <View style={[styles.taskThumb, { backgroundColor: thumb.boxBg }]}>
        <Ionicons name={thumb.name} size={22} color={thumb.color} />
      </View>
      <View style={styles.taskBody}>
        <View style={styles.taskTitleRow}>
          <Text style={[styles.taskTitle, d && styles.taskTextDone]} numberOfLines={2}>
            {plan.title}
          </Text>
          <View style={[styles.tagInline, { backgroundColor: plan.tagBg }, d && styles.tagMuted]}>
            <Text style={[styles.tagText, d && styles.tagTextMuted]}>
              {plan.tag === '购物' ? '待办' : plan.tag}
            </Text>
          </View>
        </View>
        {dateLabel ? (
          <Text style={[styles.taskDate, d && styles.taskDateDone]} numberOfLines={1}>
            {dateLabel}
          </Text>
        ) : null}
      </View>
    </>
  );

  if (bulkMode) {
    return (
      <View style={[styles.taskCard, done && styles.taskCardDone]}>
        {!done ? (
          <GlassSurface pointerEvents="none" tint="surface" style={StyleSheet.absoluteFillObject} />
        ) : null}
        <SpringPressable
          pressableStyle={styles.taskCardMainPressable}
          style={[styles.taskCardMain, styles.taskCardBulk]}
          onPress={() => togglePlanSelect(plan.id)}
          shrink={0.98}
        >
          {mainInnerStatic(done)}
        </SpringPressable>
        <EasePressable
          pressableStyle={styles.taskBulkCheckboxHit}
          style={styles.taskBulkCheckboxHit}
          shrink={0.94}
          onPress={() => togglePlanSelect(plan.id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: sel }}
          accessibilityLabel={sel ? '取消选择' : '选择'}
        >
          <View style={[styles.bulkRadioOuter, sel && styles.bulkRadioOuterOn]}>
            {sel ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
          </View>
        </EasePressable>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[styles.taskCard, styles.taskCardDone]}>
        <SpringPressable
          pressableStyle={styles.taskCardMainPressable}
          style={styles.taskCardMain}
          onPress={() => onOpenDetail(plan)}
          onLongPress={() => enterBulkWithPlan(plan.id)}
          delayLongPress={320}
          shrink={0.99}
        >
          {mainInnerStatic(true)}
        </SpringPressable>
        <Pressable
          style={styles.taskCircleHit}
          disabled
          accessibilityRole="button"
          accessibilityLabel="已完成"
        >
          <View style={[styles.taskOutlineCircle, styles.taskOutlineCircleDone]}>
            <Ionicons name="checkmark" size={11} color={colors.textLight} />
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.taskCard,
        {
          opacity: cardOpacity,
          transform: [{ translateY: ty }],
        },
      ]}
    >
      <GlassSurface pointerEvents="none" tint="surface" style={StyleSheet.absoluteFillObject} />
      <SpringPressable
        pressableStyle={styles.taskCardMainPressable}
        style={styles.taskCardMain}
        onPress={() => onOpenDetail(plan)}
        onLongPress={() => enterBulkWithPlan(plan.id)}
        delayLongPress={320}
        shrink={0.99}
      >
        <Animated.View style={[styles.taskThumb, { backgroundColor: thumb.boxBg }, { opacity: iconDim }]}>
          <Ionicons name={thumb.name} size={22} color={thumb.color} />
        </Animated.View>
        <View style={styles.taskBody}>
          <View style={styles.taskTitleRow}>
            <View style={styles.taskTitleStackFlex}>
              <Animated.Text style={[styles.taskTitle, { opacity: baseOpacity }]} numberOfLines={2}>
                {plan.title}
              </Animated.Text>
              <Animated.Text
                style={[styles.taskTitle, styles.taskTitleDoneOverlay, { opacity: doneOpacity }]}
                numberOfLines={2}
              >
                {plan.title}
              </Animated.Text>
            </View>
            <View style={styles.tagInlineWrap}>
              <Animated.View style={[styles.tagInline, { backgroundColor: plan.tagBg }, { opacity: baseOpacity }]}>
                <Text style={styles.tagText}>{plan.tag === '购物' ? '待办' : plan.tag}</Text>
              </Animated.View>
              <Animated.View
                style={[
                  styles.tagInline,
                  styles.tagInlineOverlay,
                  { backgroundColor: plan.tagBg },
                  { opacity: doneOpacity },
                ]}
              >
                <Text style={[styles.tagText, styles.tagTextMuted]}>
                  {plan.tag === '购物' ? '待办' : plan.tag}
                </Text>
              </Animated.View>
            </View>
          </View>
          {dateLabel ? (
            <Animated.Text
              style={[styles.taskDate, { opacity: baseOpacity }]}
              numberOfLines={1}
            >
              {dateLabel}
            </Animated.Text>
          ) : null}
        </View>
      </SpringPressable>
      <EasePressable
        pressableStyle={styles.taskCircleHit}
        style={styles.taskCircleHit}
        shrink={0.9}
        onPress={handleComplete}
        accessibilityRole="button"
        accessibilityLabel="标记为已完成"
      >
        <View style={styles.taskOutlineCircle}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.taskCircleFill,
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

type PlanKind = 'shopping' | 'expiry';

const PLAN_TYPE_META: Record<
  PlanKind,
  { label: string; tag: string; tagBg: string; accent?: 'danger' }
> = {
  shopping: { label: '待办', tag: '待办', tagBg: '#E6D9B0' },
  expiry: { label: '过期提醒', tag: '过期提醒', tagBg: '#E0C4C4', accent: 'danger' },
};

export function PlansScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const navigation = useTabWithStackNavigation();
  const { setPayload } = useInventoryBulkTab();
  const { plans, completePlan, addPlan, updatePlan, removePlansByIds } = useAppData();
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  /** 非空时为编辑已有事项；保存可选「新建」或「覆盖」 */
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planKind, setPlanKind] = useState<PlanKind>('shopping');
  const [planExpectedTime, setPlanExpectedTime] = useState('');
  const [planDetail, setPlanDetail] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [planSortAnchor, setPlanSortAnchor] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      setPlanSortAnchor(new Date());
    }, [])
  );

  const orderedPlans = useMemo(() => {
    const open = sortPendingPlansForPreview(
      plans.filter((p) => !p.completed),
      planSortAnchor
    );
    const done = plans.filter((p) => p.completed);
    return [...open, ...done];
  }, [plans, planSortAnchor]);

  const exitBulkMode = useCallback(() => {
    setBulkMode(false);
    setSelectedIds([]);
  }, []);

  const togglePlanSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const enterBulkWithPlan = useCallback((id: string) => {
    setBulkMode(true);
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const allVisibleSelected = useMemo(() => {
    const ids = orderedPlans.map((p) => p.id);
    return (
      ids.length > 0 &&
      ids.length === selectedIds.length &&
      ids.every((id) => selectedIds.includes(id))
    );
  }, [orderedPlans, selectedIds]);

  const selectAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(orderedPlans.map((p) => p.id));
  }, [allVisibleSelected, orderedPlans]);

  const confirmBulkDeletePlans = useCallback(() => {
    if (!selectedIds.length) return;
    Alert.alert('批量删除', `确定删除已选的 ${selectedIds.length} 条计划？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          removePlansByIds(selectedIds);
          exitBulkMode();
        },
      },
    ]);
  }, [selectedIds, removePlansByIds, exitBulkMode]);

  const handleBulkDelete = useCallback(() => {
    if (!selectedIds.length) {
      Alert.alert('提示', '请先选择要删除的计划');
      return;
    }
    confirmBulkDeletePlans();
  }, [selectedIds, confirmBulkDeletePlans]);

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
      summary: `已选（${selectedIds.length}）条`,
      showMove: false,
      allVisibleSelected,
      onSelectAll: selectAllVisible,
      onMoveToGroup: () => {},
      onDelete: handleBulkDelete,
    });
  }, [bulkMode, selectedIds, allVisibleSelected, selectAllVisible, handleBulkDelete, setPayload]);

  useEffect(() => {
    return () => setPayload(null);
  }, [setPayload]);

  const resetPlanFormUi = () => {
    setDatePickerOpen(false);
  };

  const closePlanModal = () => {
    resetPlanFormUi();
    setEditingPlanId(null);
    setAddOpen(false);
  };

  const openAddModal = () => {
    setEditingPlanId(null);
    setPlanKind('shopping');
    setPlanExpectedTime('');
    setPlanDetail('');
    resetPlanFormUi();
    setAddOpen(true);
  };

  const openEditModal = useCallback(
    (plan: ItemPlan) => {
      setEditingPlanId(plan.id);
      setPlanKind(plan.tag === '过期提醒' ? 'expiry' : 'shopping');
      setPlanExpectedTime(plan.footer?.trim() ?? '');
      setPlanDetail(plan.detail ?? '');
      if (!plan.footer?.trim() && typeof plan.reminderAt === 'number' && plan.reminderAt > 0) {
        setPlanExpectedTime(formatISODate(new Date(plan.reminderAt)));
      }
      setDatePickerOpen(false);
      setAddOpen(true);
    },
    []
  );

  const submitPlan = (mode: 'create' | 'asNew' | 'overwrite') => {
    const detail = planDetail.trim();
    if (!detail) {
      Alert.alert('提示', '请填写计划具体内容');
      return;
    }
    const lines = detail.split(/\r?\n/).map((s) => s.trim());
    const firstLine = lines.find(Boolean) ?? detail;
    const titleFromDetail =
      firstLine.length > 36 ? `${firstLine.slice(0, 36)}…` : firstLine;
    const footer = planExpectedTime.trim();
    const meta = PLAN_TYPE_META[planKind];

    if (mode === 'overwrite' && editingPlanId) {
      updatePlan(editingPlanId, {
        title: titleFromDetail,
        detail,
        footer,
        tag: meta.tag,
        tagBg: meta.tagBg,
        accent: meta.accent,
        reminderAt: undefined,
        externalCalendarEventId: undefined,
      });
      playSaveSuccess();
      closePlanModal();
      return;
    }

    addPlan({
      title: titleFromDetail,
      detail,
      footer,
      tag: meta.tag,
      tagBg: meta.tagBg,
      accent: meta.accent,
    });
    playSaveSuccess();
    closePlanModal();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleRowLeft}>
          <HeaderMenuOutlineButton />
          <PlansBellAnimatedIcon size={30} />
          <Text style={styles.title}>物品计划</Text>
        </View>
        <DoodleCatInline size={48} />
      </View>

      {!bulkMode ? (
        <SpringPressable style={styles.addPlanBtn} onPress={openAddModal} shrink={0.98}>
          <Ionicons name="add" size={22} color={colors.onPrimary} />
          <Text style={styles.addPlanText}>新增计划</Text>
        </SpringPressable>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bulkMode ? 75 + insets.bottom : 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>待办事项</Text>
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
              style={styles.sectionGearBtn}
              shrink={0.92}
              accessibilityLabel="管理，批量操作"
            >
              <GlassSurface pointerEvents="none" tint="surface" style={StyleSheet.absoluteFillObject} />
              <Text style={styles.sectionGearBtnText}>管理</Text>
              <Ionicons name="cog-outline" size={18} color={colors.textOnGlass} />
            </SpringPressable>
          )}
        </View>

        {orderedPlans.map((p) => (
          <PlansTaskCard
            key={p.id}
            plan={p}
            bulkMode={bulkMode}
            selectedIds={selectedIds}
            togglePlanSelect={togglePlanSelect}
            completePlan={completePlan}
            enterBulkWithPlan={enterBulkWithPlan}
            onOpenDetail={openEditModal}
          />
        ))}
      </ScrollView>

      <Modal
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (datePickerOpen) setDatePickerOpen(false);
          else closePlanModal();
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (datePickerOpen) setDatePickerOpen(false);
              else closePlanModal();
            }}
          />
          <View style={[styles.modalCard, { paddingBottom: 16 + insets.bottom }]}>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={datePickerOpen}
              nestedScrollEnabled
              contentContainerStyle={styles.modalScrollContent}
            >
            <Text style={styles.modalTitle}>{editingPlanId ? '计划明细' : '新增计划'}</Text>
            <Text style={styles.modalLabel}>计划类型（必选）</Text>
            <View style={styles.typeRow}>
              {(Object.keys(PLAN_TYPE_META) as PlanKind[]).map((k) => {
                const active = planKind === k;
                const m = PLAN_TYPE_META[k];
                return (
                  <SpringPressable
                    key={k}
                    style={[styles.typeChip, active && styles.typeChipActive]}
                    onPress={() => setPlanKind(k)}
                    shrink={0.96}
                  >
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{m.label}</Text>
                  </SpringPressable>
                );
              })}
            </View>
            <Text style={styles.modalLabel}>预计时间（可选）</Text>
            <View style={styles.dateFieldWrap}>
              <EasePressable
                pressableStyle={styles.dateField}
                style={styles.dateField}
                shrink={0.99}
                onPress={() => {
                  Keyboard.dismiss();
                  setDatePickerOpen((o) => !o);
                }}
                accessibilityRole="button"
                accessibilityLabel="选择预计日期"
              >
                <Text
                  style={[styles.dateFieldText, !planExpectedTime && styles.dateFieldPlaceholder]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {planExpectedTime || '选择日期（可选）'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
              </EasePressable>
              {datePickerOpen ? (
                <View style={styles.datePopover} pointerEvents="box-none">
                  <PlanDatePickerPanel
                    value={planExpectedTime}
                    onSelect={(iso) => {
                      setPlanExpectedTime(iso);
                      setDatePickerOpen(false);
                    }}
                    onClear={() => {
                      setPlanExpectedTime('');
                      setDatePickerOpen(false);
                    }}
                  />
                </View>
              ) : null}
            </View>
            <Text style={styles.modalLabel}>计划内容（必填）</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="请填写计划具体内容，如时间、数量、位置等"
              placeholderTextColor={colors.textLight}
              value={planDetail}
              onChangeText={setPlanDetail}
              multiline
              textAlignVertical="top"
              {...doneReturnKeyProps}
            />
            <View style={styles.modalActions}>
              <SpringPressable style={styles.modalBtnGhost} onPress={closePlanModal} shrink={0.96}>
                <Text style={styles.modalBtnGhostText}>取消</Text>
              </SpringPressable>
              {editingPlanId ? (
                <>
                  <SpringPressable
                    style={styles.modalBtnPrimary}
                    onPress={() => submitPlan('asNew')}
                    shrink={0.96}
                  >
                    <Text style={styles.modalBtnPrimaryText}>新建</Text>
                  </SpringPressable>
                  <SpringPressable
                    style={styles.modalBtnPrimary}
                    onPress={() => submitPlan('overwrite')}
                    shrink={0.96}
                  >
                    <Text style={styles.modalBtnPrimaryText}>覆盖</Text>
                  </SpringPressable>
                </>
              ) : (
                <SpringPressable
                  style={styles.modalBtnPrimary}
                  onPress={() => submitPlan('create')}
                  shrink={0.96}
                >
                  <Text style={styles.modalBtnPrimaryText}>保存</Text>
                </SpringPressable>
              )}
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 20 },
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
  sectionGearBtn: {
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
  sectionGearBtnText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textOnGlass,
  },
  doneBulkBtn: {
    minHeight: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  doneBulkText: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: colors.onPrimary,
  },
  scroll: { paddingBottom: 100 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  /** 与首页 planRow / planIconBox 对齐；主区域整块可点，右侧圆圈单独点 */
  taskCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'transparent',
    borderRadius: radius.surface,
    paddingRight: 8,
    marginBottom: 10,
    gap: 0,
    overflow: 'hidden',
  },
  taskCardDone: {
    backgroundColor: 'rgba(243, 243, 243, 0.85)',
    borderColor: '#E4E4E4',
  },
  /** 多选：左侧名片区域变淡（与仓库 tileBulk 一致）；勾选框在同排右侧，不参与变淡 */
  taskCardBulk: { opacity: 0.52 },
  taskCardMainPressable: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 8,
    justifyContent: 'center',
  },
  taskCardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  taskThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.surface,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskBody: { flex: 1, minWidth: 0, justifyContent: 'center' },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 0,
  },
  taskTitleStackFlex: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    minHeight: 22,
    justifyContent: 'center',
  },
  tagInlineWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  tagInline: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.surface,
    flexShrink: 0,
  },
  tagInlineOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  tagText: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textOnGlass },
  tagMuted: { opacity: 0.75 },
  tagTextMuted: { color: colors.textOnGlassMuted },
  taskTitle: { flex: 1, minWidth: 0, fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  taskDate: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.text,
    opacity: 0.85,
  },
  taskDateDone: { color: colors.textLight },
  taskTitleDoneOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textLight,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.textLight,
  },
  taskDetailStack: {
    position: 'relative',
    alignSelf: 'stretch',
    minHeight: 20,
  },
  taskDetail: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  taskDetailDanger: { color: colors.danger },
  taskDetailMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  taskDetailMetaDone: {
    color: colors.textLight,
  },
  taskDetailAbsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  taskTextDone: {
    color: colors.textLight,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.textLight,
  },
  /** 多选时勾选框固定在卡片最右侧 */
  taskBulkCheckboxHit: {
    paddingLeft: 4,
    paddingRight: 6,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    alignSelf: 'stretch',
  },
  /** 批量：右侧圆形勾选，与单条完成态一致 */
  bulkRadioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textMuted,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkRadioOuterOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  /** 与首页 HomeScreen planCompleteCircle 一致；仅圆圈完成，不进编辑 */
  taskCircleHit: {
    paddingLeft: 4,
    paddingRight: 6,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    alignSelf: 'stretch',
  },
  taskOutlineCircle: {
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
  taskCircleFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 11,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskOutlineCircleDone: {
    borderColor: '#CFCFCF',
    backgroundColor: '#E8E8E8',
  },
  addPlanBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.surface,
  },
  addPlanText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 16 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalCard: {
    backgroundColor: colors.modalCardBg,
    borderTopLeftRadius: radius.surface,
    borderTopRightRadius: radius.surface,
    paddingHorizontal: 20,
    paddingTop: 18,
    zIndex: 2,
    elevation: 8,
    overflow: 'visible',
    maxHeight: '94%',
  },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { paddingBottom: 12 },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: colors.modalCardText,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.modalCardText,
    marginBottom: 8,
  },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.2)',
    backgroundColor: '#fff',
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.modalCardText,
  },
  typeChipTextActive: { color: colors.onPrimary },
  dateFieldWrap: {
    alignSelf: 'stretch',
    marginBottom: 14,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.18)',
    borderRadius: radius.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
    backgroundColor: '#fff',
  },
  dateFieldText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.modalCardText,
    flex: 1,
    marginRight: 10,
    lineHeight: 22,
  },
  dateFieldPlaceholder: { fontFamily: fonts.medium, color: colors.modalCardMuted },
  /** 随 ScrollView 内容向下展开，避免绝对定位被裁切 */
  datePopover: {
    marginTop: 10,
    alignSelf: 'stretch',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.18)',
    borderRadius: radius.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.modalCardText,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  modalTextArea: { minHeight: 100, marginBottom: 18 },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: 'rgba(58, 74, 90, 0.2)',
    backgroundColor: '#fff',
  },
  modalBtnGhostText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.modalCardText,
  },
  modalBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
  },
  modalBtnPrimaryText: { fontSize: 15, fontFamily: fonts.bold, color: colors.onPrimary },
});
