import { useState, useMemo, type CSSProperties } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import BracketCanvas, { TeamSlot, matchTop, MATCH_H, COL_GAP } from '../components/BracketCanvas';
import Flag from '../components/Flag';
import {
  buildBracketData,
  isMatchInRound,
  matchTeamNames,
  nextKnockoutMatch,
  slotName,
  type BracketSlot,
} from '../utils/bracketBuilder';
import type { CanvasMatch, OfficialSlotContext } from '../components/BracketCanvas';

import OfficialGroupsView from '../components/Home/OfficialGroupsView';
import OfficialBracketTabs from '../components/official/OfficialBracketTabs';
import FeaturedMatchBanner from '../components/official/FeaturedMatchBanner';
import BracketInfoPanel from '../components/official/BracketInfoPanel';
import OfficialMobileCenter from '../components/official/OfficialMobileCenter';

/** Cuadro oficial: los cruces reales del torneo, con los terceros resueltos en vivo. */
function OfficialBracket() {
  const { activeGroupPoolFormat, activeCompetitionFormatType, loadingGroup, groupError } =
    useAppContext();

  const isMatchDay =
    activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE';

  if (loadingGroup)
    return (
      <p className="p-6 text-center text-muted" role="status">
        Cargando liga...
      </p>
    );
  if (groupError)
    return (
      <p className="p-6 text-center text-[#ff7675]" role="alert">
        No se pudo cargar la liga. Inténtalo de nuevo.
      </p>
    );
  if (activeCompetitionFormatType && isMatchDay) {
    return <Navigate to="/tabla" replace />;
  }

  return <OfficialBracketView />;
}

function OfficialBracketView() {
  const {
    officialPoints,
    groupOdds,
    allGames,
    matchRadar,
    topScorers,
    topScorersLoading,
    topScorersError,
    refreshTopScorers,
    activeGroupPichichi,
  } = useAppContext();

  const [activePanel, setActivePanel] = useState<'live' | 'scorers' | null>(null);
  const [activeTab, setActiveTab] = useState<'cuadro' | 'grupos'>('cuadro');

  const part = useMemo(
    () => buildBracketData(officialPoints, groupOdds, allGames),
    [officialPoints, groupOdds, allGames],
  );

  const featuredMatch = useMemo(() => nextKnockoutMatch(allGames), [allGames]);

  const { leftRounds, rightRounds } = useMemo(() => {
    const toMatches = (arr: BracketSlot[][] | undefined): CanvasMatch<BracketSlot>[] =>
      (arr || []).map((m) => ({ home: m?.[0] || null, away: m?.[1] || null }));

    return {
      leftRounds: [
        toMatches(part.r32?.slice(0, 8)),
        toMatches(part.r16?.slice(0, 4)),
        toMatches(part.qf?.slice(0, 2)),
        toMatches(part.sf?.slice(0, 1)),
      ],
      rightRounds: [
        toMatches(part.r32?.slice(8, 16)),
        toMatches(part.r16?.slice(4, 8)),
        toMatches(part.qf?.slice(2, 4)),
        toMatches(part.sf?.slice(1, 2)),
      ],
    };
  }, [part]);

  if (!part) {
    return (
      <section className="view-section flex justify-center items-center min-h-[50vh]">
        <h2 className="text-muted">Cargando cuadro oficial...</h2>
      </section>
    );
  }

  const renderSlot = (teamOrObj: BracketSlot | undefined, context?: OfficialSlotContext) => {
    const isObj = typeof teamOrObj === 'object' && teamOrObj !== null;
    const name = slotName(teamOrObj);
    const isProv = isObj ? teamOrObj.isProvisional : false;

    let style: CSSProperties = isProv ? { border: '1px dashed #ff4757' } : {};

    let scoreContent = null;
    let oppName: string | null = null;
    if (context && name && !name.includes('º') && name !== 'Por definir') {
      const { side, roundIndex, matchIndex, isHome } = context;
      let opponent = null;
      if (side === 'left') {
        opponent = isHome
          ? leftRounds[roundIndex][matchIndex]?.away
          : leftRounds[roundIndex][matchIndex]?.home;
      } else if (side === 'right') {
        opponent = isHome
          ? rightRounds[roundIndex][matchIndex]?.away
          : rightRounds[roundIndex][matchIndex]?.home;
      } else if (side === 'center') {
        if (roundIndex === 'final') opponent = isHome ? part.final?.[1] : part.final?.[0];
        else if (roundIndex === 'thirdPlaceMatch')
          opponent = isHome ? part.thirdPlaceMatch?.[1] : part.thirdPlaceMatch?.[0];
      }

      oppName = slotName(opponent);

      const m = (allGames || []).find((g) => {
        if (!g) return false;
        if (!isMatchInRound(g, context?.roundIndex)) return false;
        if (oppName && !oppName.includes('º') && oppName !== 'Por definir') {
          if (
            (matchTeamNames(g.home, name) && matchTeamNames(g.away, oppName)) ||
            (matchTeamNames(g.home, oppName) && matchTeamNames(g.away, name))
          ) {
            return true;
          }
        }
        if (roundIndex === 'final') {
          return matchTeamNames(g.home, name) || matchTeamNames(g.away, name);
        }
        if (roundIndex === 'thirdPlaceMatch') {
          return matchTeamNames(g.home, name) || matchTeamNames(g.away, name);
        }
        return false;
      });

      if (m && m.home_score != null && m.away_score != null) {
        const isHomeInMatch = matchTeamNames(m.home, name);
        const score = isHomeInMatch ? m.home_score : m.away_score;

        let isWinner = false;
        if (m.winner) {
          isWinner = matchTeamNames(m.winner, name);
        } else if (!isProv) {
          isWinner = isHomeInMatch ? m.home_score > m.away_score : m.away_score > m.home_score;
        }

        scoreContent = (
          <span
            className={`ml-1 text-[0.85em] font-bold bg-[rgba(255,255,255,0.05)] bg-none py-0.5 px-1 rounded-[4px] ${isWinner ? 'text-[#2ecc71]' : 'text-muted'}`}
          >
            {score}
          </span>
        );
      }
    }

    let isFeatured = false;
    let isLive = false;
    if (featuredMatch && name && !name.includes('º') && name !== 'Por definir' && name !== '???') {
      if (isMatchInRound(featuredMatch, context?.roundIndex)) {
        if (featuredMatch.home === name || featuredMatch.away === name) {
          isFeatured = true;
          if (featuredMatch.date && new Date(featuredMatch.date) <= new Date()) {
            isLive = true;
          }
        }
      }
    }

    if (isFeatured) {
      style = {
        ...style,
        border: isLive ? '2px solid #ff4757' : '2px solid #00d2d3',
        position: 'relative',
        zIndex: 10,
        fontWeight: 'bold',
      };
    }

    return <TeamSlot name={name} slotStyle={style} rightContent={scoreContent} />;
  };

  const hiddenRounds = {
    0: false,
    1: false,
    2: false,
    3: false,
  };

  const finalTopY = matchTop(3, 0);

  const getName = slotName;
  const getIsProv = (t: BracketSlot | undefined) =>
    typeof t === 'object' && t ? t.isProvisional : false;

  const centerContent = (colW: number) => (
    <div className="block">
      <div
        className="absolute text-center text-[0.65rem] font-bold text-gold tracking-[0.5px] uppercase"
        style={{ top: finalTopY - 22, left: COL_GAP, width: colW }}
      >
        Final
      </div>
      <div
        className="match final-match absolute"
        style={{ top: finalTopY, left: COL_GAP, width: colW }}
      >
        {renderSlot(part.final?.[0], { side: 'center', roundIndex: 'final', isHome: true })}
        {renderSlot(part.final?.[1], { side: 'center', roundIndex: 'final', isHome: false })}
      </div>

      <div
        className="absolute text-center"
        style={{ top: finalTopY + MATCH_H + 18, left: COL_GAP, width: colW }}
      >
        <div className="text-[0.65rem] font-bold text-gold tracking-[0.5px] uppercase mb-1.5">
          Campeón
        </div>
        <div className="champion-display">
          <div
            className={`team-slot h-12.5 text-[1.1rem] font-bold justify-center pointer-events-none bg-[rgba(146,_64,_14,_0.1)] bg-none text-gold ${getIsProv(part.champion) ? 'border-[#ff4757]' : 'border-gold'} ${getIsProv(part.champion) ? 'border-dashed' : 'border-solid'}`}
          >
            <Flag
              team={getName(part.champion) || ''}
              size="w40"
              style={{
                width: 24,
                height: 18,
                borderRadius: 2,
                marginRight: 8,
                verticalAlign: 'middle',
              }}
            />
            {getName(part.champion) || '???'}
          </div>
        </div>
      </div>

      <div
        className="absolute"
        style={{ top: finalTopY + MATCH_H + 18 + MATCH_H + 44, left: COL_GAP, width: colW }}
      >
        <div className="text-[0.65rem] font-bold text-muted tracking-[0.5px] uppercase mb-1.5 text-center">
          Tercer puesto
        </div>
        <div className="match third-place">
          {renderSlot(part.thirdPlaceMatch?.[0], {
            side: 'center',
            roundIndex: 'thirdPlaceMatch',
            isHome: true,
          })}
          {renderSlot(part.thirdPlaceMatch?.[1], {
            side: 'center',
            roundIndex: 'thirdPlaceMatch',
            isHome: false,
          })}
        </div>
        <div className="mt-2 text-center">
          <div className="text-[0.65rem] font-bold text-[#9a3412] tracking-[0.5px] uppercase mb-1">
            Ganador del tercer puesto
          </div>
          <div className="champion-display">
            <div
              className={`team-slot h-9.5 text-[0.95rem] font-bold justify-center pointer-events-none bg-[rgba(154,_52,_18,_0.1)] bg-none text-[#9a3412] ${getIsProv(part.thirdPlaceWinner) ? 'border-[#ff4757]' : 'border-[#9a3412]'} ${getIsProv(part.thirdPlaceWinner) ? 'border-dashed' : 'border-solid'}`}
            >
              <Flag
                team={getName(part.thirdPlaceWinner) || ''}
                size="w40"
                style={{
                  width: 20,
                  height: 15,
                  borderRadius: 2,
                  marginRight: 6,
                  verticalAlign: 'middle',
                }}
              />
              {getName(part.thirdPlaceWinner) || '???'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section className="view-section block pt-0 relative">
      <OfficialBracketTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        activeGroupPichichi={activeGroupPichichi}
      />

      {activeTab === 'grupos' ? (
        <OfficialGroupsView />
      ) : (
        <>
          {featuredMatch && <FeaturedMatchBanner featuredMatch={featuredMatch} />}

          <div className="flex flex-col items-center mb-2.5 relative z-[50]">
            {activePanel && (
              <BracketInfoPanel
                activePanel={activePanel}
                setActivePanel={setActivePanel}
                matchRadar={matchRadar}
                topScorers={topScorers}
                topScorersLoading={topScorersLoading}
                topScorersError={topScorersError}
                refreshTopScorers={refreshTopScorers}
              />
            )}
          </div>

          <div className="paper-panel landing-tape album-sheet">
            <BracketCanvas
              leftRounds={leftRounds}
              rightRounds={rightRounds}
              renderSlot={renderSlot}
              renderCenter={centerContent}
              hiddenRounds={hiddenRounds}
              renderFinal={() => (
                <OfficialMobileCenter
                  part={part}
                  getName={getName}
                  getIsProv={getIsProv}
                  renderSlot={renderSlot}
                />
              )}
            />
          </div>
        </>
      )}
    </section>
  );
}

export default OfficialBracket;
