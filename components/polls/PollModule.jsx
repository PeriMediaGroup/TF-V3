import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../styles/ThemeContext";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default function PollModule({
  poll,
  onVote,
  onRevoke,
  loading = false,
  disabled = false,
}) {
  const { theme } = useTheme();

  const isClosed = useMemo(() => {
    if (!poll?.closesAt) return false;
    return new Date(poll.closesAt).getTime() <= Date.now();
  }, [poll?.closesAt]);

  const totalVotesLabel = useMemo(() => {
    const total = poll?.totalVotes || 0;
    if (total === 1) return "1 vote";
    return `${total} votes`;
  }, [poll?.totalVotes]);

  const closesLabel = useMemo(() => {
    if (!poll?.closesAt) return null;
    const closes = dayjs(poll.closesAt);
    const inPast = closes.isBefore(dayjs());
    const formatted = closes.format("MMM D, h:mm a");
    return inPast ? `Closed ${closes.fromNow()}` : `Closes ${closes.fromNow()} (${formatted})`;
  }, [poll?.closesAt]);

  if (!poll) return null;

  const userSelection = poll.userVote || null;
  const disableVoting = disabled || loading || isClosed;

  return (
    <View style={[styles.container, { borderColor: theme.border }]}>
      <Text style={[styles.question, { color: theme.text }]}>{poll.question}</Text>
      {closesLabel ? (
        <Text style={[styles.meta, { color: theme.muted }]}>{closesLabel}</Text>
      ) : null}
      <View style={styles.options}>
        {poll.options?.map((option) => {
          const isSelected = userSelection === option.id;
          const percentage = option.percentage ?? 0;
          const countLabel =
            poll.totalVotes > 0 ? `${option.count} (${percentage}%)` : `${option.count} vote${option.count === 1 ? "" : "s"}`;
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => onVote?.(option.id)}
              disabled={disableVoting}
              style={[
                styles.option,
                {
                  borderColor: isSelected ? theme.primary : theme.border,
                  backgroundColor: theme.card,
                  opacity: disableVoting && !isSelected ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: disableVoting }}
            >
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${percentage}%`,
                      backgroundColor: isSelected ? theme.primary : "#505A5F",
                    },
                  ]}
                />
              </View>
              <View style={styles.optionRow}>
                <Text
                  style={[
                    styles.label,
                    {
                      color: isSelected ? theme.primary : theme.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={[styles.count, { color: theme.muted }]}>{countLabel}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.footerRow}>
        <Text style={[styles.meta, { color: theme.muted }]}>{totalVotesLabel}</Text>
        {userSelection && !isClosed ? (
          <TouchableOpacity
            onPress={() => onRevoke?.()}
            disabled={loading || disabled}
            style={styles.revokeBtn}
          >
            <Text style={[styles.revokeText, { color: theme.primary }]}>
              Change vote
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {isClosed ? (
        <Text style={[styles.closed, { color: theme.muted }]}>Voting closed</Text>
      ) : null}
      {loading ? (
        <Text style={[styles.meta, { color: theme.muted }]}>Updating…</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 12,
  },
  question: {
    fontSize: 16,
    fontWeight: "700",
  },
  options: {
    gap: 10,
  },
  option: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  barTrack: {
    height: 6,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  barFill: {
    height: "100%",
    borderRadius: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
  count: {
    fontSize: 13,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: {
    fontSize: 12,
  },
  revokeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  revokeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  closed: {
    fontSize: 12,
    fontStyle: "italic",
  },
});
