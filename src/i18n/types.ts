export type Language = "id" | "en";

export type FaqItem = { question: string; answer: string[]; steps?: string[]; exportLink?: boolean };

export type Dictionary = {
  locale: string;
  languageName: string;
  nav: { create: string; charts: string; about: string; language: string; homeLabel: string; skip: string; primary: string; footer: string };
  meta: { homeTitle: string; homeDescription: string; chartsTitle: string; chartsDescription: string; aboutTitle: string; aboutDescription: string };
  header: { note: string; edition: string };
  footer: { disclaimer: string; note: string; madeBy: string; about: string; export: string; receiptify: string; privacy: string; signoff: string };
  landing: {
    eyebrow: string; titleFirst: string; titleSecond: string; introFirst: string; introSecond: string;
    start: string; startNote: string; uploadTab: string; uploadTitle: string; uploadBody: string; uploadScope: string;
    exportLink: string; chooseFile: string; fileHelp: string; chooseAnother: string;
    usernameTitle: string; usernameBody: string; usernameScope: string; usernameLabel: string;
    usernamePlaceholder: string; load: string; retry: string; uploadInstead: string; rssDisabled: string;
    readingFile: string; loadingRss: string; privacyStatus: string; exampleAria: string; previewLabel: string; previewCaption: string; souvenir: string;
    exampleName: string; exampleTitle: string; exampleLabel: string; steps: [string, string, string];
    journeyTitle: string; journeySubtitle: string; journeySteps: [{ title: string; body: string }, { title: string; body: string }, { title: string; body: string }];
  };
  editor: {
    eyebrow: string; heading: string; intro: string; settingsHeading: string; switchSource: string; rssSource: string; exportSource: string;
    available: (count: string, range: string) => string; rssLimit: (count: string) => string;
    skippedRss: (count: string) => string; skippedExport: (count: string) => string; duplicates: (count: string) => string;
    confirmLabel: string; confirm: string; cancel: string; confirmSwitch: string; livePreview: string;
    rowsUpper: (count: string) => string; previewHelp: string; content: string; name: string; namePlaceholder: string;
    period: string; allData: string; years: string; months: string;
    sort: string; newest: string; oldest: string; topRated: string; unavailable: string; rowCount: string;
    rows: (count: string) => string; appearance: string; template: string; classic: string; ticket: string;
    valueType: string; minute: string; rating: string;
    paper: string; white: string; cream: string; emptyPeriod: string; preparing: string; download: string;
    share: string; downloadNote: string; creating: string; shared: string; shareFallback: string; downloaded: string;
    exportFailed: string; enrichmentLoading: string; enrichmentResult: (matched: string, failed: string) => string; enrichmentUnavailable: string;
  };
  receipt: {
    defaultTitle: string; examplePrefix: string; aria: (title: string, rows: string, sessions: string, unique: string) => string;
    descriptionRating: string; descriptionMissing: string; descriptionRewatch: string; tagline: string; ticketTagline: string;
    allData: string; period: (value: string) => string; noEntries: string; number: string; filmDate: string; rating: string;
    rewatch: string; sessions: string; unique: string; displayed: string; rssLatest: string; rssBasis: string;
    example: string; exportSource: string; rssSource: string; signoff: string;
    orderFor: (name: string) => string; register: string; cashier: string; movie: string; minutes: string; itemCount: string;
    totalRuntime: (matched: string, total: string) => string; thankYou: string; seeYou: string;
  };
  viewingProfile: {
    title: string; eyebrow: string; loading: string; insufficient: string;
    sessions: (count: string) => string; uniqueFilms: (count: string) => string;
    averageRating: string; noRatings: string; ratedEntries: (count: string) => string; ratingDistribution: string;
    topGenres: string; genreCoverage: (available: string, total: string) => string; incompleteMetadata: string; recentRss: string; noGenreData: string;
    genreFilms: (count: string) => string;
  };
  annualRecap: {
    title: string; selectYear: string; noYear: string; noYearBody: string; emptyTitle: string; emptyBody: (year: string) => string;
    uniqueFilms: string; sessions: string; mostActiveMonth: string; noMonth: string; topGenres: string;
    averageRating: string; noRatings: string; ratedEntries: (count: string) => string; ratingDistribution: string;
    genreCoverage: (available: string, total: string) => string; incompleteMetadata: string; recentRss: string; noGenreData: string;
    genreFilms: (count: string) => string;
    download: string; share: string; preparing: string; exportFailed: string;
  };
  charts: {
    eyebrow: string; title: string; description: string; periodTitle: string; periodDescription: string;
    allDiary: string; fourWeeks: string; sixMonths: string; thisYear: string; selectYear: string; noDiary: string; noPeriod: string; createReceipt: string;
    rssNote: string; loadingMetadata: string; metadataUnavailable: string; entryCount: (count: string) => string;
    topGenres: string; genresDescription: string; genreCoverage: (count: string) => string; noGenres: string;
    diaryActivity: string; activityDescription: string; activityValue: (month: string, count: string) => string;
    ratingDistribution: string; ratingsDescription: string; ratedEntries: (count: string) => string; noRatings: string;
    releaseDecades: string; decadesDescription: string; decadeLabel: (decade: number) => string; noDecades: string;
    mostWatchedDirectors: string; directorsDescription: string; directorCoverage: (count: string) => string; noDirectors: string;
  };
  errors: Record<string, string>;
  errorFallback: string;
  usernameInvalid: string;
  rssFallback: string;
  rssTimeout: string;
  about: {
    eyebrow: string; title: string; lead: string; waysIntro: string; ways: [string, string]; inspiration: string;
    disclaimer: string; privacyTitle: string; privacy: string[]; faqTitle: string; faqs: FaqItem[];
    creditsEyebrow: string; creditsTitle: string; creditsInspired: string; creditsData: string; creditsDisclaimer: string; tmdbAttribution: string; madeBy: string; asideTagline: string;
    expand: (question: string) => string;
  };
  globalError: { title: string; body: string; retry: string };
};
