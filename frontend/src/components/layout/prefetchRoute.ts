/** Descarga por adelantado el código de una página al pasar el ratón por su enlace. */
export const prefetchRoute = (path: string) => {
  switch (path) {
    case '/ranking':
      import('../../pages/Leaderboard');
      break;
    case '/jornadas':
      import('../../pages/MatchdayPredictor');
      break;
    case '/tabla':
      import('../../pages/LeagueStandings');
      break;
    case '/radar':
      import('../../pages/Radar');
      break;
    case '/bracket':
      import('../../pages/OfficialBracket');
      break;
    case '/grupos':
      import('../../pages/Home');
      break;
    case '/search':
      import('../../pages/Search');
      break;
    case '/stats':
      import('../../pages/Stats');
      break;
    case '/mis-ligas':
      import('../../pages/GroupsDashboard');
      break;
  }
};
