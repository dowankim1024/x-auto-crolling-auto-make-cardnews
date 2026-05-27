export type WatchedXSourceAccount = {
  handle: string;
  displayName?: string;
  sportType: string;
  sourceTier: number;
  isActive: boolean;
};

export const WATCHED_X_SOURCE_ACCOUNTS: WatchedXSourceAccount[] = [
  {
    handle: "FabrizioRomano",
    displayName: "Fabrizio Romano",
    sportType: "PL",
    sourceTier: 1,
    isActive: true,
  },
  {
    handle: "news1sports_x",
    displayName: "News1 Sports",
    sportType: "SPORTS",
    sourceTier: 2,
    isActive: true,
  },
];
