// Duration is in seconds. Contact is the normalized phase that releases each move.
export const HERO_ACTIONS = {
  attack: [
    { duration: .48, contact: .39 },
    { duration: .54, contact: .43 },
    { duration: .70, contact: .52 }
  ],
  gale: { duration: .76, contact: .45 },
  quake: { duration: .92, contact: .55 },
  heal: { duration: .76, contact: .50 },
  dodge: { duration: .52, contact: .16 }
};
