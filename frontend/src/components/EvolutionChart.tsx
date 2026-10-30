import React, { useState, useMemo } from 'react';
import {
  buildEvolution,
  buildStages,
  type ChartUser,
  type EvolutionChartProps,
  type Selection,
  type TimeScale,
} from './evolution/evolutionData';
import ChartToolbar from './evolution/ChartToolbar';
import StageInspector from './evolution/StageInspector';
import ChartCanvas from './evolution/ChartCanvas';
import ParticipantFilter from './evolution/ParticipantFilter';

export default function EvolutionChart({ validResults, userName, allGames }: EvolutionChartProps) {
  const [mode, setMode] = useState<'rank' | 'points'>('rank');
  const [timeScale, setTimeScale] = useState<TimeScale>('rounds');
  const [hoveredUser, setHoveredUser] = useState<ChartUser['key'] | null>(null);
  const [hoveredStageIdx, setHoveredStageIdx] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1); // Zoom horizontal de 0.75 a 3.5

  // Default selected: all if <= 10, otherwise top 8 + current user
  const defaultSelected = useMemo(() => {
    if (!validResults || validResults.length === 0) return {};
    const sel: Selection = {};
    validResults.forEach((r, idx) => {
      const isMe = r.name === userName;
      if (validResults.length <= 10 || idx < 8 || isMe) {
        sel[r.key] = true;
      } else {
        sel[r.key] = false;
      }
    });
    return sel;
  }, [validResults, userName]);

  const [selectedUsers, setSelectedUsers] = useState(defaultSelected);

  React.useEffect(() => {
    if (Object.keys(selectedUsers).length === 0 && validResults.length > 0) {
      setTimeout(() => setSelectedUsers(defaultSelected), 0);
    }
  }, [defaultSelected, selectedUsers, validResults.length]);

  const toggleUser = (key: ChartUser['key']) => {
    setSelectedUsers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    const sel: Selection = {};
    validResults.forEach((r) => (sel[r.key] = true));
    setSelectedUsers(sel);
  };

  const selectNone = () => {
    const sel: Selection = {};
    validResults.forEach((r) => (sel[r.key] = false));
    setSelectedUsers(sel);
  };

  const selectTopN = (n: number) => {
    const sel: Selection = {};
    validResults.forEach((r, idx) => {
      sel[r.key] = idx < n || r.name === userName;
    });
    setSelectedUsers(sel);
  };

  // Build active stages array depending on timeScale.
  // CRITICAL: Never include Inicio (r0). Always end EXACTLY at the last round/match actually played/scored.
  const activeStages = useMemo(
    () => buildStages(timeScale, validResults, allGames),
    [timeScale, allGames, validResults],
  );

  // Calculate cumulative points, rank, and smart Y-axis zoom based on selected users
  const evolutionData = useMemo(
    () => buildEvolution(validResults, userName, timeScale, activeStages, selectedUsers),
    [validResults, userName, timeScale, activeStages, selectedUsers],
  );

  const { users, yMin, yMax, yGridLines, maxRank } = evolutionData;

  const width = 1100;
  const height = 350;
  const padding = { top: 35, right: 45, bottom: 45, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (idx: number) =>
    padding.left + (idx / Math.max(activeStages.length - 1, 1)) * chartW;

  const getY = (val: number, isRank: boolean) => {
    if (isRank) {
      if (maxRank === 1) return padding.top + chartH / 2;
      return padding.top + ((val - 1) / (maxRank - 1)) * chartH;
    } else {
      const range = Math.max(yMax - yMin, 1);
      return padding.top + chartH - ((val - yMin) / range) * chartH;
    }
  };

  const currentInspectedStage = hoveredStageIdx !== null ? activeStages[hoveredStageIdx] : null;
  const inspectedIdx = hoveredStageIdx ?? 0;

  return (
    <div className="bg-[rgba(15,_15,_26,_0.8)] bg-none border border-[rgba(255,_255,_255,_0.08)] rounded-[16px] py-5 px-3.5 my-0 mx-auto w-full max-w-350 shadow-[0_10px_30px_rgba(0,0,0,0.3)] box-border">
      {/* Header & Mode/Scale Toggles */}
      <ChartToolbar
        mode={mode}
        setMode={setMode}
        timeScale={timeScale}
        setTimeScale={setTimeScale}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        setHoveredStageIdx={setHoveredStageIdx}
      />

      {/* LIVE TELEMETRY BAR / INSPECTOR PANEL */}
      <StageInspector
        mode={mode}
        setHoveredStageIdx={setHoveredStageIdx}
        selectedUsers={selectedUsers}
        users={users}
        currentInspectedStage={currentInspectedStage}
        inspectedIdx={inspectedIdx}
      />

      {/* SVG Interactive Chart with Touch & Widescreen Optimization */}
      <ChartCanvas
        mode={mode}
        timeScale={timeScale}
        zoomLevel={zoomLevel}
        hoveredUser={hoveredUser}
        setHoveredUser={setHoveredUser}
        hoveredStageIdx={hoveredStageIdx}
        setHoveredStageIdx={setHoveredStageIdx}
        selectedUsers={selectedUsers}
        activeStages={activeStages}
        users={users}
        yGridLines={yGridLines}
        maxRank={maxRank}
        width={width}
        height={height}
        padding={padding}
        chartW={chartW}
        chartH={chartH}
        getX={getX}
        getY={getY}
      />

      {/* Participant Filter Controls */}
      <ParticipantFilter
        mode={mode}
        hoveredUser={hoveredUser}
        setHoveredUser={setHoveredUser}
        selectedUsers={selectedUsers}
        toggleUser={toggleUser}
        selectAll={selectAll}
        selectNone={selectNone}
        selectTopN={selectTopN}
        activeStages={activeStages}
        users={users}
      />
    </div>
  );
}
