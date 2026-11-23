import React from 'react'

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const make = (children) =>
  function Icon(props) {
    return (
      <svg {...base} {...props}>
        {children}
      </svg>
    )
  }

export const Home = make(<><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>)
export const Book = make(<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 18.5z" /><path d="M8 7h8M8 10.5h5" /></>)
export const Target = make(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>)
export const Headphones = make(<><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4.5" height="7" rx="2" /><rect x="16.5" y="13" width="4.5" height="7" rx="2" /><path d="M20 19a3 3 0 0 1-3 2h-2" /></>)
export const KeyIcon = make(<><circle cx="8" cy="14" r="4" /><path d="m11 11 8-8" /><path d="m16 4 3 3" /><path d="m13.5 6.5 3 3" /></>)
export const Table = make(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M3 15h18M9.5 9.5V20M16 9.5V20" /></>)
export const Chart = make(<><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-4M12.5 16V8M17 16v-7" /></>)
export const Settings = make(<><circle cx="12" cy="12" r="3" /><path d="M19.4 14.5a7.6 7.6 0 0 0 .1-2.4l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2-1.2L15 4.5h-4l-.3 2.5a7.6 7.6 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2.5l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2 1.2l.3 2.5h4l.3-2.5a7.6 7.6 0 0 0 2-1.2l2.3 1 2-3.4z" /></>)
export const Play = make(<path d="M8 5.5v13l11-6.5z" />)
export const Pause = make(<><path d="M9 5v14M15 5v14" /></>)
export const Volume = make(<><path d="M4 9.5v5h3L12 19V5L7 9.5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 6a8.5 8.5 0 0 1 0 12" /></>)
export const VolumeOff = make(<><path d="M4 9.5v5h3L12 19V5L7 9.5z" /><path d="m16 9.5 4 5M20 9.5l-4 5" /></>)
export const Sun = make(<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>)
export const Moon = make(<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />)
export const Menu = make(<><path d="M4 7h16M4 12h16M4 17h16" /></>)
export const Close = make(<><path d="m6 6 12 12M18 6 6 18" /></>)
export const Check = make(<path d="m5 12.5 4.5 4.5L19 7" />)
export const ArrowRight = make(<><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>)
export const ChevronRight = make(<path d="m9 5 7 7-7 7" />)
export const Spark = make(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" /><circle cx="12" cy="12" r="2.5" /></>)
export const Flame = make(<path d="M12 21c3.9 0 6.5-2.6 6.5-6 0-4.4-4.2-6.2-4.2-10.5-2.3 1-3.3 3-3.3 4.8 0 1.2.4 2.1.4 2.6 0 .9-.8 1.6-1.6 1.6-1 0-1.7-.8-1.7-2.1C6.3 12.6 5.5 14 5.5 15c0 3.4 2.6 6 6.5 6z" />)
export const Info = make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none" /></>)
export const Refresh = make(<><path d="M20 11a8 8 0 1 0-.6 4" /><path d="M20 5v6h-6" /></>)
export const Shuffle = make(<><path d="M4 7h3l10 10h3" /><path d="M17 4l3 3-3 3" /><path d="M4 17h3l3-3" /><path d="M17 14l3 3-3 3" /><path d="m13 10 1.5-1.5" /></>)
export const Trash = make(<><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6.5 7l.8 12.5h9.4L17.5 7" /><path d="M10 11v5M14 11v5" /></>)
export const Download = make(<><path d="M12 4v11" /><path d="m7.5 11 4.5 4.5L16.5 11" /><path d="M4.5 19.5h15" /></>)
export const Lock = make(<><rect x="5" y="10" width="14" height="10" rx="2.5" /><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" /></>)
export const Clock = make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>)
export const Ear = make(<><path d="M7 9a5 5 0 0 1 10 0c0 3-3 3.5-3 6a3.5 3.5 0 0 1-6 2.5" /><path d="M10.5 9a1.5 1.5 0 0 1 3 0c0 1.5-1.5 1.8-1.5 3" /></>)
export const Send = make(<><path d="M20 4 3.5 10.6l6.5 2.6L12.6 20z" /><path d="m10 13.2 4.4-4.4" /></>)
export const Wand = make(<><path d="M5 19 16 8" /><path d="m14 4 1 2.5L17.5 8 15 9l-1 2.5L13 9l-2.5-1L13 6.5z" /><path d="M19 14.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" /></>)
export const Grid = make(<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>)
export const Trophy = make(<><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 5H5.5v1.5A3 3 0 0 0 8.5 9.5" /><path d="M16 5h2.5v1.5a3 3 0 0 1-3 3" /><path d="M12 13v4" /><path d="M8.5 20.5h7l-.7-3.5H9.2z" /></>)
export const Search = make(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>)
