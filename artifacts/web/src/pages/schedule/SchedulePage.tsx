import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Clock, Globe, Check, Loader2 } from "lucide-react";
import api from "../../lib/api";
import type { Schedule, Channel, Workspace } from "../../types";

function safeJson(val: string | undefined | null): any {
  try { return JSON.parse(val || "[]"); } catch { return []; }
}

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const [maxVideos, setMaxVideos] = useState(3);
  const [timezone, setTimezone] = useState("UTC");
  const [uploadTimes, setUploadTimes] = useState<string[]>(["09:00", "21:00"]);
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmPm] = useState("PM");
  const [showOverrides, setShowOverrides] = useState<Set<string>>(new Set());
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | undefined>(undefined);
  const [overrideForm, setOverrideForm] = useState<Record<string, { videosPerDay: number; timezone: string; uploadTimes: string[]; hour: string; minute: string; ampm: string }>>({});
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["schedules"],
    queryFn: () => api.get("/schedule"),
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });

  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: () => api.get("/workspaces"),
  });

  const filteredChannels = selectedWorkspaceId
    ? channels.filter((c) => c.workspaceId === selectedWorkspaceId)
    : channels;

  const applyGlobal = useMutation({
    mutationFn: () => api.post("/schedule/global", { maxVideosPerDay: maxVideos, timezone, uploadTimes, workspaceId: selectedWorkspaceId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });

  const updateOverride = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/schedule/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });

  const deleteSchedule = useMutation({
    mutationFn: (id: string) => api.delete(`/schedule/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });

  const addTime = () => {
    let h = parseInt(hour);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const time = `${h.toString().padStart(2, "0")}:${minute}`;
    if (!uploadTimes.includes(time)) {
      setUploadTimes([...uploadTimes, time].sort());
    }
  };

  const removeTime = (t: string) => {
    setUploadTimes(uploadTimes.filter(x => x !== t));
  };

  const toggleOverride = (id: string) => {
    setShowOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Initialize override form from existing schedule
        if (!overrideForm[id]) {
          const s = scheduleMap.get(id);
          const schTimes = safeJson(s?.uploadTimes);
          setOverrideForm(f => ({
            ...f,
            [id]: {
              videosPerDay: parseInt(s?.maxVideosPerDay || "3"),
              timezone: s?.timezone || "UTC",
              uploadTimes: schTimes.length > 0 ? schTimes : ["09:00", "21:00"],
              hour: "12",
              minute: "00",
              ampm: "PM",
            }
          }));
        }
      }
      return next;
    });
  };

  const formatTime12 = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const userSchedules = schedules.filter((s) => {
    const ch = filteredChannels.find((c) => c.id === s.channelId);
    return ch;
  });

  const scheduleMap = new Map<string, Schedule>();
  for (const s of userSchedules) {
    scheduleMap.set(s.channelId!, s);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Schedule</h1>

      <div className="bg-[#1a1a1a] border border-indigo-500/20 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={18} className="text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">Global Schedule</h2>
          <p className="text-xs text-zinc-500 ml-2">Applies to all channels instantly. Use this to set the same schedule across all {filteredChannels.length} channels at once.</p>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-64">
            <label className="text-xs text-zinc-500 block mb-2">WORKSPACE / GMAIL</label>
            <select value={selectedWorkspaceId || ""} onChange={(e) => setSelectedWorkspaceId(e.target.value || undefined)}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-sm text-white">
              <option value="">All Workspaces</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.email || w.name || w.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-2">VIDEOS PER DAY</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} onClick={() => setMaxVideos(n)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${maxVideos === n ? 'bg-indigo-600 text-white' : 'bg-[#0f0f0f] text-zinc-400 border border-[#2a2a2a] hover:border-indigo-500/30'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-2">TIMEZONE</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-sm text-white">
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Asia/Tokyo">Tokyo</option>
              <option value="Asia/Kolkata">India (IST)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-2">ADD UPLOAD TIME</label>
            <div className="flex gap-1">
              <select value={hour} onChange={(e) => setHour(e.target.value)}
                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-1 py-1.5 text-sm text-white w-14">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h.toString().padStart(2, "0")}>{h.toString().padStart(2, "0")}</option>
                ))}
              </select>
              <span className="text-zinc-500 self-center">:</span>
              <select value={minute} onChange={(e) => setMinute(e.target.value)}
                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-1 py-1.5 text-sm text-white w-14">
                {["00", "10", "20", "30", "40", "50"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select value={ampm} onChange={(e) => setAmPm(e.target.value)}
                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-1 py-1.5 text-sm text-white w-14">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
              <button onClick={addTime} className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-lg text-xs font-medium">+ Add</button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <Clock size={14} className="text-zinc-500" />
          <span className="text-xs text-zinc-400">
            {timezone}: {now.toLocaleTimeString("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
          </span>
          <span className="text-xs text-zinc-600">|</span>
          <span className="text-xs text-zinc-400">
            Pakistan: {now.toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
          </span>
        </div>

        {uploadTimes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {uploadTimes.map((t) => (
              <span key={t} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                {formatTime12(t)}
                <button onClick={() => removeTime(t)} className="hover:text-white ml-1">&times;</button>
              </span>
            ))}
          </div>
        )}

        <button onClick={() => applyGlobal.mutate()} disabled={applyGlobal.isPending || filteredChannels.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          {applyGlobal.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {selectedWorkspaceId
            ? `Apply to ${filteredChannels.length} in ${workspaces.find(w => w.id === selectedWorkspaceId)?.email || selectedWorkspaceId}`
            : `Apply to All ${filteredChannels.length} Channels`}
        </button>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">Per-Channel Overrides</h3>

        {filteredChannels.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-6">No channels yet. Import a channel first.</p>
        ) : (
          <div className="space-y-2">
            {filteredChannels.map((ch) => {
              const s = scheduleMap.get(ch.id);
              const isOpen = showOverrides.has(ch.id);
              const schTimes = safeJson(s?.uploadTimes);
              const schDays = safeJson(s?.activeDays);
              const vidPerDay = s?.maxVideosPerDay || "3";
              return (
                <div key={ch.id} className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg overflow-hidden">
                  <button onClick={() => toggleOverride(ch.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      {isOpen ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                      <div className="text-left">
                        <p className="text-sm text-white font-medium">{ch.channelName || ch.youtubeChannelId || "Unnamed Channel"}</p>
                        <p className="text-xs text-zinc-500">{ch.workspaceEmail || "No email"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <span>{schTimes.length > 0 ? schTimes.map(formatTime12).join(", ") : "—"}</span>
                      <span className="text-zinc-400">{vidPerDay}/day</span>
                      <div className="w-16 text-right">
                        <span className="text-zinc-600">
                          {now.toLocaleTimeString("en-US", { timeZone: timezone || "UTC", hour: "2-digit", minute: "2-digit", hour12: true })}
                        </span>
                      </div>
                    </div>
                  </button>
                  {isOpen && (() => {
                    const form = overrideForm[ch.id] || { videosPerDay: 3, timezone: "UTC", uploadTimes: ["09:00", "21:00"], hour: "12", minute: "00", ampm: "PM" };
                    const addOvTime = () => {
                      let h = parseInt(form.hour);
                      if (form.ampm === "PM" && h !== 12) h += 12;
                      if (form.ampm === "AM" && h === 12) h = 0;
                      const time = `${h.toString().padStart(2, "0")}:${form.minute}`;
                      if (!form.uploadTimes.includes(time)) {
                        setOverrideForm(f => ({ ...f, [ch.id]: { ...form, uploadTimes: [...form.uploadTimes, time].sort() } }));
                      }
                    };
                    const removeOvTime = (t: string) => {
                      setOverrideForm(f => ({ ...f, [ch.id]: { ...form, uploadTimes: form.uploadTimes.filter(x => x !== t) } }));
                    };
                    const saveOverride = () => {
                      updateOverride.mutate({
                        id: s?.id || ch.id,
                        data: {
                          maxVideosPerDay: String(form.videosPerDay),
                          timezone: form.timezone,
                          uploadTimes: JSON.stringify(form.uploadTimes),
                          channelId: ch.id,
                          scheduledAt: new Date(),
                          cronExpression: `0 ${form.uploadTimes.map(t => t.split(":")[1]).join(",")} * * *`,
                          active: true,
                        }
                      });
                    };
                    return (
                      <div className="px-4 pb-4 border-t border-[#2a2a2a] pt-3">
                        <p className="text-xs text-zinc-500 mb-3">Override settings for this channel:</p>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div>
                            <label className="text-[10px] text-zinc-600 block mb-1">VIDEOS PER DAY</label>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5, 6].map(n => (
                                <button key={n} onClick={() => setOverrideForm(f => ({ ...f, [ch.id]: { ...form, videosPerDay: n } }))}
                                  className={`w-7 h-7 rounded text-xs font-medium ${form.videosPerDay === n ? 'bg-indigo-600 text-white' : 'bg-[#0f0f0f] text-zinc-400 border border-[#2a2a2a]'}`}>
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-600 block mb-1">TIMEZONE</label>
                            <select value={form.timezone} onChange={(e) => setOverrideForm(f => ({ ...f, [ch.id]: { ...form, timezone: e.target.value } }))}
                              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white">
                              <option value="UTC">UTC</option>
                              <option value="America/New_York">Eastern</option>
                              <option value="America/Los_Angeles">Pacific</option>
                              <option value="Europe/London">London</option>
                              <option value="Asia/Tokyo">Tokyo</option>
                              <option value="Asia/Kolkata">India</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-600 block mb-1">ADD TIME</label>
                            <div className="flex gap-1">
                              <select value={form.hour} onChange={(e) => setOverrideForm(f => ({ ...f, [ch.id]: { ...form, hour: e.target.value } }))}
                                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-1 py-1 text-xs text-white w-10">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                  <option key={h} value={h.toString().padStart(2, "0")}>{h.toString().padStart(2, "0")}</option>
                                ))}
                              </select>
                              <span className="text-zinc-500 self-center text-xs">:</span>
                              <select value={form.minute} onChange={(e) => setOverrideForm(f => ({ ...f, [ch.id]: { ...form, minute: e.target.value } }))}
                                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-1 py-1 text-xs text-white w-10">
                                {["00", "10", "20", "30", "40", "50"].map((m) => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                              <select value={form.ampm} onChange={(e) => setOverrideForm(f => ({ ...f, [ch.id]: { ...form, ampm: e.target.value } }))}
                                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-1 py-1 text-xs text-white w-10">
                                <option value="AM">AM</option><option value="PM">PM</option>
                              </select>
                              <button onClick={addOvTime} className="bg-indigo-600 hover:bg-indigo-700 text-white px-1.5 py-1 rounded text-[10px] font-medium">+</button>
                            </div>
                          </div>
                        </div>
                        {form.uploadTimes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {form.uploadTimes.map(t => (
                              <span key={t} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                {formatTime12(t)}
                                <button onClick={() => removeOvTime(t)} className="hover:text-white">&times;</button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={saveOverride} disabled={updateOverride.isPending}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
                            {updateOverride.isPending ? "Saving..." : "Save Override"}
                          </button>
                          <button onClick={() => deleteSchedule.mutate(s?.id || "")} className="text-xs text-red-400 hover:text-red-300 border border-red-400/20 px-3 py-1.5 rounded-lg">Remove Schedule</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
