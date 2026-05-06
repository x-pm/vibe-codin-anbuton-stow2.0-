import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { EasePressable } from './EasePressable';
import { radius } from '../theme/radius';
import { formatISODate, parseISODate } from '../utils/planDates';

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

export { formatISODate, parseISODate } from '../utils/planDates';

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function getMonthGrid(year: number, monthIndex: number): { d: Date; inMonth: boolean }[][] {
  const first = new Date(year, monthIndex, 1);
  const mondayFirst = (first.getDay() + 6) % 7;
  const rows: { d: Date; inMonth: boolean }[][] = [];
  const cur = new Date(year, monthIndex, 1 - mondayFirst);
  for (let r = 0; r < 6; r++) {
    const row: { d: Date; inMonth: boolean }[] = [];
    for (let c = 0; c < 7; c++) {
      row.push({
        d: new Date(cur),
        inMonth: cur.getMonth() === monthIndex,
      });
      cur.setDate(cur.getDate() + 1);
    }
    rows.push(row);
  }
  return rows;
}

const YEAR_MIN = 2020;
const YEAR_MAX = 2036;

type Props = {
  value: string;
  onSelect: (iso: string) => void;
  onClear: () => void;
};

export function PlanDatePickerPanel({ value, onSelect, onClear }: Props) {
  const initialView = useMemo(() => {
    const parsed = value ? parseISODate(value) : null;
    return startOfMonth(parsed ?? new Date());
  }, [value]);

  const [viewMonth, setViewMonth] = useState<Date>(initialView);
  const [menu, setMenu] = useState<'none' | 'year' | 'month'>('none');

  useEffect(() => {
    setViewMonth(initialView);
  }, [initialView]);

  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const grid = useMemo(() => getMonthGrid(y, m), [y, m]);
  const selectedISO = value.trim();

  const goPrevMonth = useCallback(() => {
    setMenu('none');
    setViewMonth((v) => addMonths(v, -1));
  }, []);

  const goNextMonth = useCallback(() => {
    setMenu('none');
    setViewMonth((v) => addMonths(v, 1));
  }, []);

  const pickYear = useCallback((year: number) => {
    setViewMonth(new Date(year, m, 1));
    setMenu('none');
  }, [m]);

  const pickMonth = useCallback((monthIdx: number) => {
    setViewMonth(new Date(y, monthIdx, 1));
    setMenu('none');
  }, [y]);

  const pickDay = useCallback(
    (d: Date) => {
      setMenu('none');
      onSelect(formatISODate(d));
    },
    [onSelect]
  );

  const pickToday = useCallback(() => {
    setMenu('none');
    onSelect(formatISODate(new Date()));
  }, [onSelect]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let yr = YEAR_MIN; yr <= YEAR_MAX; yr++) list.push(yr);
    return list;
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <EasePressable
          pressableStyle={[styles.dropdownBox, menu === 'year' && styles.dropdownBoxOpen]}
          style={[styles.dropdownBox, menu === 'year' && styles.dropdownBoxOpen]}
          shrink={0.98}
          onPress={() => setMenu((x) => (x === 'year' ? 'none' : 'year'))}
        >
          <Text style={styles.dropdownText}>{y}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </EasePressable>
        <EasePressable
          pressableStyle={[styles.dropdownBox, menu === 'month' && styles.dropdownBoxOpen]}
          style={[styles.dropdownBox, menu === 'month' && styles.dropdownBoxOpen]}
          shrink={0.98}
          onPress={() => setMenu((x) => (x === 'month' ? 'none' : 'month'))}
        >
          <Text style={styles.dropdownText}>{m + 1}月</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </EasePressable>
        <View style={styles.navArrows}>
          <EasePressable
            pressableStyle={styles.arrowHit}
            style={styles.arrowHit}
            shrink={0.9}
            onPress={goPrevMonth}
            accessibilityLabel="上一月"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </EasePressable>
          <EasePressable
            pressableStyle={styles.arrowHit}
            style={styles.arrowHit}
            shrink={0.9}
            onPress={goNextMonth}
            accessibilityLabel="下一月"
          >
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </EasePressable>
        </View>
      </View>

      {menu === 'year' ? (
        <ScrollView style={styles.menuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <View style={styles.yearWrap}>
            {years.map((yr) => (
              <EasePressable
                key={yr}
                pressableStyle={[styles.yearChip, yr === y && styles.yearChipActive]}
                style={[styles.yearChip, yr === y && styles.yearChipActive]}
                shrink={0.96}
                onPress={() => pickYear(yr)}
              >
                <Text style={[styles.yearChipText, yr === y && styles.yearChipTextActive]}>{yr}</Text>
              </EasePressable>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {menu === 'month' ? (
        <View style={styles.monthWrap}>
          {Array.from({ length: 12 }, (_, i) => (
            <EasePressable
              key={i}
              pressableStyle={[styles.monthChip, i === m && styles.monthChipActive]}
              style={[styles.monthChip, i === m && styles.monthChipActive]}
              shrink={0.96}
              onPress={() => pickMonth(i)}
            >
              <Text style={[styles.monthChipText, i === m && styles.monthChipTextActive]}>{i + 1}月</Text>
            </EasePressable>
          ))}
        </View>
      ) : null}

      <View style={styles.weekRow}>
        {WEEK_LABELS.map((label) => (
          <Text key={label} style={styles.weekCell}>
            {label}
          </Text>
        ))}
      </View>
      {grid.map((row, ri) => (
        <View key={ri} style={styles.dayRow}>
          {row.map(({ d, inMonth }, ci) => {
            const iso = formatISODate(d);
            const isSel = iso === selectedISO;
            return (
              <EasePressable
                key={`${ri}-${ci}`}
                pressableStyle={[styles.dayHit, isSel && styles.dayHitSelected]}
                style={[styles.dayHit, isSel && styles.dayHitSelected]}
                shrink={0.94}
                onPress={() => pickDay(d)}
              >
                <Text style={[styles.dayNum, !inMonth && styles.dayNumMuted, isSel && styles.dayNumSelected]}>
                  {d.getDate()}
                </Text>
              </EasePressable>
            );
          })}
        </View>
      ))}

      <View style={styles.footerRow}>
        <EasePressable
          pressableStyle={styles.todayBtn}
          style={styles.todayBtn}
          shrink={0.97}
          onPress={pickToday}
          accessibilityLabel="今天"
        >
          <Ionicons name="locate-outline" size={18} color={colors.textMuted} />
          <Text style={styles.todayText}>今天</Text>
        </EasePressable>
        <EasePressable
          pressableStyle={styles.clearBtn}
          style={styles.clearBtn}
          shrink={0.97}
          onPress={() => {
            setMenu('none');
            onClear();
          }}
          accessibilityLabel="清除日期"
        >
          <Text style={styles.clearText}>清除</Text>
        </EasePressable>
      </View>
    </View>
  );
}

const CELL_H = 46;

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dropdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  dropdownBoxOpen: {
    borderColor: '#7EB6E8',
    backgroundColor: '#F3F8FD',
  },
  dropdownText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.text },
  navArrows: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  arrowHit: { padding: 6 },
  menuScroll: { maxHeight: 140, marginBottom: 10 },
  yearWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  yearChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  yearChipActive: { borderColor: '#7EB6E8', backgroundColor: '#D6E8FA' },
  yearChipText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.text },
  yearChipTextActive: { color: colors.text },
  monthWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  monthChip: {
    width: '22%',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  monthChipActive: { borderColor: '#7EB6E8', backgroundColor: '#D6E8FA' },
  monthChipText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.text },
  monthChipTextActive: { color: colors.text },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    paddingVertical: 6,
  },
  dayRow: {
    flexDirection: 'row',
    marginBottom: 4,
    justifyContent: 'space-between',
    gap: 2,
  },
  dayHit: {
    flex: 1,
    minWidth: 0,
    height: CELL_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.surface,
  },
  dayHitSelected: { backgroundColor: '#D6E8FA' },
  dayNum: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    includeFontPadding: false,
  },
  dayNumMuted: { color: colors.textLight, fontFamily: fonts.medium },
  dayNumSelected: { color: colors.text },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 14,
    paddingTop: 12,
    paddingBottom: 4,
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 28,
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  todayText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textMuted, lineHeight: 22 },
  clearBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  clearText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textLight, lineHeight: 22 },
});
