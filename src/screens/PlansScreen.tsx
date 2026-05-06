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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoodleCatInline } from '../components/DoodleCatInline';
import { PlanDatePickerPanel } from '../components/PlanDatePickerPanel';
import { EasePressable } from '../components/EasePressable';
import { HeaderBrandMark } from '../components/HeaderBrandMark';
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
import { createStowPlanCalendarEvent } from '../services/planCalendarSync';
import { formatPlanReminderAt, formatTimeOnly, parseISODate } from '../utils/planDates';
import { getPlanThumbIcon, sortPendingPlansForPreview } from '../utils/planDisplay';

const SLIDE_DOWN_PX = Math.min(300, Dimensions.get('window').height * 0.38);

type PlansTaskCardProps = {
  plan: ItemPlan;
  bulkMode: boolean;
  selectedIds: string[];
  togglePlanSelect: (id: string) => void;
  completePlan: (id: string) => void;
};

/** 未完成：点圆圈 → 灰字删除线 → 向下滑出淡出 → 标记完成（已完成项仍为静态灰字样式） */
function PlansTaskCard({
  plan,
  bulkMode,
  selectedIds,
  togglePlanSelect,
  completePlan,
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

  /** 与普通模式相同布局：标题、标签、完整计划内容及日期后缀；多选时整卡外加 taskCardBulk 变淡 */
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
            <Text style={[styles.tagText, d && styles.tagTextMuted]}>{plan.tag}</Text>
          </View>
        </View>
        <Text
          style={[
            styles.taskDetail,
            plan.accent === 'danger' && styles.taskDetailDanger,
            d && styles.taskTextDone,
          ]}
          numberOfLines={3}
        >
          {plan.detail}
          {plan.footer ? (
            <Text style={[styles.taskDetailMeta, d && styles.taskDetailMetaDone]}> · 预计 {plan.footer}</Text>
          ) : null}
          {plan.reminderAt != null ? (
            <Text style={[styles.taskDetailMeta, d && styles.taskDetailMetaDone]}>
              {' '}
              · 提醒 {formatPlanReminderAt(plan.reminderAt)}
            </Text>
          ) : null}
        </Text>
      </View>
    </>
  );

  if (bulkMode) {
    return (
      <View style={[styles.taskCard, done && styles.taskCardDone]}>
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
        <View style={styles.taskCardMain}>{mainInnerStatic(true)}</View>
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
      <View style={styles.taskCardMain}>
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
                <Text style={styles.tagText}>{plan.tag}</Text>
              </Animated.View>
              <Animated.View
                style={[
                  styles.tagInline,
                  styles.tagInlineOverlay,
                  { backgroundColor: plan.tagBg },
                  { opacity: doneOpacity },
                ]}
              >
                <Text style={[styles.tagText, styles.tagTextMuted]}>{plan.tag}</Text>
              </Animated.View>
            </View>
          </View>
          <View style={styles.taskDetailStack}>
            <Animated.View style={{ opacity: baseOpacity }}>
              <Text
                style={[styles.taskDetail, plan.accent === 'danger' && styles.taskDetailDanger]}
                numberOfLines={3}
              >
                {plan.detail}
                {plan.footer ? <Text style={styles.taskDetailMeta}> · 预计 {plan.footer}</Text> : null}
              </Text>
            </Animated.View>
            <Animated.View style={[styles.taskDetailAbsOverlay, { opacity: doneOpacity }]}>
              <Text style={[styles.taskDetail, styles.taskTextDone]} numberOfLines={3}>
                {plan.detail}
                {plan.footer ? (
                  <Text style={[styles.taskDetailMeta, styles.taskDetailMetaDone]}> · 预计 {plan.footer}</Text>
                ) : null}
              </Text>
            </Animated.View>
          </View>
        </View>
      </View>
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
  shopping: { label: '购物', tag: '购物', tagBg: '#F5E6A8' },
  expiry: { label: '过期提醒', tag: '过期提醒', tagBg: '#FAD4D4', accent: 'danger' },
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
  const [planKind, setPlanKind] = useState<PlanKind>('shopping');
  const [planExpectedTime, setPlanExpectedTime] = useState('');
  const [planDetail, setPlanDetail] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  /** 在已选预计日期的前提下，是否写入系统日历并提醒 */
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderUseCustomTime, setReminderUseCustomTime] = useState(false);
  const [reminderClock, setReminderClock] = useState(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  /** iOS 滚轮上的时刻；确认后写入 reminderClock 并展示文案 */
  const [reminderTimeDraft, setReminderTimeDraft] = useState(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [customTimeConfirmedText, setCustomTimeConfirmedText] = useState('');
  /** iOS：确认后隐藏滚轮，仅展示「已选择」；点「修改时刻」再展开 */
  const [iosTimeWheelVisible, setIosTimeWheelVisible] = useState(true);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
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

  const openAddModal = () => {
    setPlanKind('shopping');
    setPlanExpectedTime('');
    setPlanDetail('');
    setDatePickerOpen(false);
    setReminderEnabled(false);
    setReminderUseCustomTime(false);
    setTimePickerOpen(false);
    const c = new Date();
    c.setHours(12, 0, 0, 0);
    setReminderClock(c);
    setReminderTimeDraft(c);
    setCustomTimeConfirmedText('');
    setIosTimeWheelVisible(true);
    setAddOpen(true);
  };

  const submitPlan = () => {
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

    let reminderAt: number | undefined;
    if (reminderEnabled && planExpectedTime.trim()) {
      const day = parseISODate(planExpectedTime);
      if (day) {
        const t = new Date(day);
        if (reminderUseCustomTime) {
          const src = Platform.OS === 'ios' ? reminderTimeDraft : reminderClock;
          t.setHours(src.getHours(), src.getMinutes(), 0, 0);
        } else {
          t.setHours(12, 0, 0, 0);
        }
        reminderAt = t.getTime();
      }
    }

    const newId = addPlan({
      title: titleFromDetail,
      detail,
      footer,
      tag: meta.tag,
      tagBg: meta.tagBg,
      accent: meta.accent,
      reminderAt,
    });

    if (reminderAt != null) {
      void (async () => {
        const ext = await createStowPlanCalendarEvent({
          title: `【STOW】${titleFromDetail}`,
          notes: detail,
          start: new Date(reminderAt!),
        });
        if (ext) {
          updatePlan(newId, { externalCalendarEventId: ext });
        } else {
          Alert.alert(
            '未能写入系统日历',
            Platform.OS === 'ios'
              ? '计划已保存在 STOW 内。\n\n• 请到「设置 → 隐私与安全性 → 日历」中允许 STOW；iOS 17 起若系统提供「完全访问日历」，请选完全访问以便写入。\n• 提醒依赖系统「日历」的通知，请到「设置 → 通知 → 日历」打开允许通知。\n• 若使用 Expo Go 扫码运行，日历写入常不可用，请用 Mac 执行 npx expo run:ios 安装到本机后再试。'
              : '计划已保存在 STOW 内。请到系统设置中为 STOW 开启「日历」读写权限，并确认本机已登录可编辑的日历账户；完成后再试。',
            [{ text: '知道了' }]
          );
        }
      })();
    }

    setDatePickerOpen(false);
    setTimePickerOpen(false);
    setIosTimeWheelVisible(true);
    setAddOpen(false);
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
            <SpringPressable onPress={exitBulkMode} style={styles.sectionGearBtn} shrink={0.95}>
              <Text style={styles.doneBulkText}>完成</Text>
            </SpringPressable>
          ) : (
            <SpringPressable
              onPress={() => setBulkMode(true)}
              style={styles.sectionGearBtn}
              shrink={0.92}
              accessibilityLabel="批量管理"
            >
              <Ionicons name="cog-outline" size={22} color={colors.text} />
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
          />
        ))}
      </ScrollView>

      <Modal
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDatePickerOpen(false);
          setTimePickerOpen(false);
          setCustomTimeConfirmedText('');
          setIosTimeWheelVisible(true);
          setAddOpen(false);
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
              else if (timePickerOpen) setTimePickerOpen(false);
              else {
                setCustomTimeConfirmedText('');
                setIosTimeWheelVisible(true);
                setAddOpen(false);
              }
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
            <Text style={styles.modalTitle}>新增计划</Text>
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
            <Text style={styles.reminderHintText}>
              打开「是否提醒」后，会在系统日历中创建日程并在该时间提醒；须先选择下方预计日期。未指定具体时刻时，默认当天 12:00。
            </Text>
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
                      setReminderEnabled(false);
                      setReminderUseCustomTime(false);
                      setTimePickerOpen(false);
                      setCustomTimeConfirmedText('');
                      setIosTimeWheelVisible(true);
                    }}
                  />
                </View>
              ) : null}
            </View>
            <View style={styles.reminderTimeBlock}>
              <View style={styles.reminderTimeSwitchRow}>
                <Text style={styles.reminderTimeLabel}>是否提醒（同步系统日历）</Text>
                <Switch
                  value={reminderEnabled}
                  disabled={!planExpectedTime.trim()}
                  onValueChange={(v) => {
                    setReminderEnabled(v);
                    if (!v) {
                      setReminderUseCustomTime(false);
                      setTimePickerOpen(false);
                      setCustomTimeConfirmedText('');
                      setIosTimeWheelVisible(true);
                    }
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.border}
                  accessibilityLabel="是否提醒，同步系统日历"
                />
              </View>
              {!planExpectedTime.trim() ? (
                <Text style={styles.reminderNeedDateText}>
                  请先在上面的「预计时间」里选择日期，再打开本开关；否则无法写入日历。
                </Text>
              ) : null}
              {planExpectedTime.trim() && reminderEnabled ? (
                  <>
                    <View style={[styles.reminderTimeSwitchRow, styles.reminderSubSwitchRow]}>
                      <Text style={styles.reminderTimeLabelSecondary}>指定具体时刻</Text>
                      <Switch
                        value={reminderUseCustomTime}
                        onValueChange={(v) => {
                          setReminderUseCustomTime(v);
                          setCustomTimeConfirmedText('');
                          setIosTimeWheelVisible(true);
                          if (v) {
                            const base = new Date(reminderClock);
                            setReminderTimeDraft(base);
                            if (Platform.OS === 'android') setTimePickerOpen(true);
                          } else {
                            setTimePickerOpen(false);
                          }
                        }}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.surface}
                        ios_backgroundColor={colors.border}
                        accessibilityLabel="指定具体时刻"
                      />
                    </View>
                    {!reminderUseCustomTime ? (
                      <Text style={styles.reminderNoonText}>未指定时刻时，将使用所选日期当天 12:00</Text>
                    ) : Platform.OS === 'ios' ? (
                      <View style={styles.iosTimePickWrap}>
                        {iosTimeWheelVisible ? (
                          <>
                            <DateTimePicker
                              value={reminderTimeDraft}
                              mode="time"
                              display="spinner"
                              onChange={(_e, d) => d && setReminderTimeDraft(d)}
                            />
                            <SpringPressable
                              style={styles.timeConfirmBtn}
                              onPress={() => {
                                const next = new Date(reminderTimeDraft);
                                setReminderClock(next);
                                setCustomTimeConfirmedText(`已选择 ${formatTimeOnly(next)}`);
                                setIosTimeWheelVisible(false);
                              }}
                              shrink={0.98}
                              accessibilityRole="button"
                              accessibilityLabel="确认所选时刻"
                            >
                              <Text style={styles.timeConfirmBtnText}>确认</Text>
                            </SpringPressable>
                          </>
                        ) : (
                          <View style={styles.iosTimeDoneRow}>
                            <Text style={styles.customTimeConfirmed}>
                              {customTimeConfirmedText || `已选择 ${formatTimeOnly(reminderClock)}`}
                            </Text>
                            <SpringPressable
                              style={styles.timeChangeBtn}
                              onPress={() => {
                                setReminderTimeDraft(new Date(reminderClock));
                                setIosTimeWheelVisible(true);
                                setCustomTimeConfirmedText('');
                              }}
                              shrink={0.98}
                              accessibilityRole="button"
                              accessibilityLabel="修改时刻"
                            >
                              <Text style={styles.timeChangeBtnText}>修改时刻</Text>
                            </SpringPressable>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View>
                        <SpringPressable
                          style={styles.timePickBtn}
                          onPress={() => setTimePickerOpen(true)}
                          shrink={0.98}
                        >
                          <Text style={styles.timePickBtnText}>{formatTimeOnly(reminderClock)}</Text>
                          <Ionicons name="time-outline" size={20} color={colors.text} />
                        </SpringPressable>
                        {customTimeConfirmedText ? (
                          <Text style={styles.customTimeConfirmed}>{customTimeConfirmedText}</Text>
                        ) : null}
                        {timePickerOpen ? (
                          <DateTimePicker
                            value={reminderClock}
                            mode="time"
                            is24Hour
                            display="default"
                            onChange={(_e, d) => {
                              if (Platform.OS === 'android') setTimePickerOpen(false);
                              if (d) {
                                setReminderClock(d);
                                setReminderTimeDraft(d);
                                setCustomTimeConfirmedText(`已选择 ${formatTimeOnly(d)}`);
                              }
                            }}
                          />
                        ) : null}
                      </View>
                    )}
                  </>
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
            />
            <View style={styles.modalActions}>
              <SpringPressable
                style={styles.modalBtnGhost}
                onPress={() => {
                  setDatePickerOpen(false);
                  setTimePickerOpen(false);
                  setCustomTimeConfirmedText('');
                  setIosTimeWheelVisible(true);
                  setAddOpen(false);
                }}
                shrink={0.96}
              >
                <Text style={styles.modalBtnGhostText}>取消</Text>
              </SpringPressable>
              <SpringPressable style={styles.modalBtnPrimary} onPress={submitPlan} shrink={0.96}>
                <Text style={styles.modalBtnPrimaryText}>保存</Text>
              </SpringPressable>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
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
  sectionGearBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  doneBulkText: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
  scroll: { paddingBottom: 32 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  /** 与首页 planRow / planIconBox 对齐 */
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.surface,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  taskCardDone: {
    backgroundColor: '#F3F3F3',
    borderColor: '#E4E4E4',
  },
  /** 多选：左侧名片区域变淡（与仓库 tileBulk 一致）；勾选框在同排右侧，不参与变淡 */
  taskCardBulk: { opacity: 0.52 },
  taskCardMainPressable: {
    flex: 1,
    minWidth: 0,
  },
  taskCardMain: {
    flex: 1,
    flexDirection: 'row',
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
  taskBody: { flex: 1 },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
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
  tagText: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.text },
  tagMuted: { opacity: 0.75 },
  tagTextMuted: { color: colors.textMuted },
  taskTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
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
    paddingLeft: 10,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
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
  /** 与首页 HomeScreen planCompleteCircle 一致 */
  taskCircleHit: {
    paddingLeft: 6,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.surface,
    borderTopRightRadius: radius.surface,
    paddingHorizontal: 20,
    paddingTop: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    zIndex: 2,
    elevation: 8,
    overflow: 'visible',
    maxHeight: '94%',
  },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.text, marginBottom: 16 },
  modalLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.text, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.text },
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
    borderColor: colors.border,
    borderRadius: radius.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
    backgroundColor: colors.bg,
  },
  dateFieldText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.text,
    flex: 1,
    marginRight: 10,
    lineHeight: 22,
  },
  dateFieldPlaceholder: { fontFamily: fonts.medium, color: colors.textLight },
  /** 随 ScrollView 内容向下展开，避免绝对定位被裁切 */
  datePopover: {
    marginTop: 10,
    alignSelf: 'stretch',
  },
  reminderHintText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: -4,
    marginBottom: 8,
  },
  reminderTimeBlock: {
    marginTop: 4,
    marginBottom: 12,
  },
  reminderNeedDateText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: 4,
  },
  reminderTimeSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reminderSubSwitchRow: {
    marginTop: 4,
    paddingLeft: 4,
  },
  reminderTimeLabel: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.text },
  reminderTimeLabelSecondary: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textMuted },
  reminderNoonText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  timePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.bg,
  },
  timePickBtnText: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.text },
  iosTimePickWrap: { alignSelf: 'stretch', marginTop: 4 },
  iosTimeDoneRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  timeConfirmBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
    marginBottom: 8,
  },
  timeConfirmBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.onPrimary },
  customTimeConfirmed: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    textAlign: 'center',
  },
  timeChangeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  timeChangeBtnText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.text },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 14,
    backgroundColor: colors.bg,
  },
  modalTextArea: { minHeight: 100, marginBottom: 18 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnGhostText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.text },
  modalBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.surface,
    backgroundColor: colors.primary,
  },
  modalBtnPrimaryText: { fontSize: 15, fontFamily: fonts.bold, color: colors.onPrimary },
});
