import { useState, useEffect, useRef } from "react";

interface Props {
  endTime: string;
  onExpired?: () => void;
  className?: string;
  compact?: boolean;
}

function formatMs(ms: number, compact: boolean): string {
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (compact) {
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m ${secs}s`;
  }

  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function CountdownTimer({ endTime, onExpired, className = "", compact = false }: Props) {
  const [ms, setMs] = useState(() => Math.max(0, new Date(endTime).getTime() - Date.now()));
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    const target = new Date(endTime).getTime();

    const tick = () => {
      const remaining = Math.max(0, target - Date.now());
      setMs(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        onExpiredRef.current?.();
      }
    };

    const initial = Math.max(0, target - Date.now());
    if (initial <= 0) {
      onExpiredRef.current?.();
      return;
    }

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]); // only re-runs if endTime prop changes — NOT on every tick

  const isUrgent = ms > 0 && ms < 60 * 60 * 1000;
  const ended = ms <= 0;

  return (
    <span
      className={`font-mono font-semibold ${ended ? "text-muted-foreground" : isUrgent ? "text-red-600" : "text-foreground"} ${className}`}
    >
      {formatMs(ms, compact)}
    </span>
  );
}
