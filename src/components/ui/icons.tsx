import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

export const MenuIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></svg>
)

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 4l8 8M12 4l-8 8" /></svg>
)

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M8 3v10M3 8h10" /></svg>
)

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 3.5L10.5 8 6 12.5" /></svg>
)

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3.5 6L8 10.5 12.5 6" /></svg>
)

export const ChevronUpDownIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 6.5L8 3.5l3 3M5 9.5l3 3 3-3" /></svg>
)

export const ArrowUpRightIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4.5 11.5l7-7M6 4.5h5.5V10" /></svg>
)

export const ArrowRightIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 8h10M9 4l4 4-4 4" /></svg>
)

export const LinkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6.5 9.5l3-3" />
    <path d="M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.5l-1 1a2.5 2.5 0 01-3.5-3.5l1-1" />
  </svg>
)

export const TerminalIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 4.5l3.5 3.5L3 11.5M8 12h5" /></svg>
)

export const FolderIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M2 5V3.5A1 1 0 013 2.5h3l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" /></svg>
)

export const BoardIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    <path d="M7 4.75h2.5a1 1 0 011 1V9" />
  </svg>
)

export const LayersIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 2.5l5.5 3L8 8.5 2.5 5.5 8 2.5z" />
    <path d="M2.5 8.5L8 11.5l5.5-3M2.5 11L8 14l5.5-3" opacity="0.5" />
  </svg>
)

export const PencilIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M11.5 2L14 4.5 5.5 13H3v-2.5L11.5 2zM10 3.5L12.5 6" /></svg>
)

export const HandIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 8V3.25a.75.75 0 011.5 0V7M7.5 3.5V2.75a.75.75 0 011.5 0V7M9 3.75a.75.75 0 011.5 0V7.5M10.5 5a.75.75 0 011.5 0v4.5c0 2.5-1.8 4-4 4S4.2 12.6 4 11L3 8.2a.8.8 0 011.4-.6L6 9.5" />
  </svg>
)

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 4.5h10M6.5 2.5h3M5 4.5l.5 8.5h5l.5-8.5M6.75 7v4M9.25 7v4" /></svg>
)

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 8.5l3 3 7-7" /></svg>
)

export const SunIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
  </svg>
)

export const MoonIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M13.5 10.2A5.6 5.6 0 015.8 2.5a5.7 5.7 0 107.7 7.7z" /></svg>
)

export const MapIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M2 4l4-1.5 4 1.5 4-1.5v9.5l-4 1.5-4-1.5-4 1.5V4zM6 2.5v9.5M10 4v9.5" /></svg>
)

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="7" cy="7" r="4.25" /><path d="M10.5 10.5L13.5 13.5" /></svg>
)

export const SwitchIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 5.5h9l-2.5-2.5M13 10.5H4l2.5 2.5" /></svg>
)

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M2.5 7.5L8 2.5l5.5 5M4 6.5V13h8V6.5" /></svg>
)

export const DotsIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <circle cx="3.5" cy="8" r="1.1" /><circle cx="8" cy="8" r="1.1" /><circle cx="12.5" cy="8" r="1.1" />
  </svg>
)

export const GlobeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M2.5 8h11M8 2.5c1.8 1.8 2.5 3.6 2.5 5.5S9.8 11.7 8 13.5M8 2.5C6.2 4.3 5.5 6.1 5.5 8s.7 3.7 2.5 5.5" />
  </svg>
)

export const BorderSolidIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="2.5" y="4" width="11" height="8" rx="1.5" /></svg>
)

export const BorderDashedIcon = (p: IconProps) => (
  <svg {...base({ ...p, strokeDasharray: '2.4 1.8' })}><rect x="2.5" y="4" width="11" height="8" rx="1.5" /></svg>
)

export const BorderNoneIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2.5" y="4" width="11" height="8" rx="1.5" opacity="0.35" />
    <path d="M4 12L12 4" opacity="0.55" />
  </svg>
)

export const DownloadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 2.5v8.5M5 8.5l3 3 3-3M3 13.5h10" />
  </svg>
)

export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2.5 5h11M2.5 11h11" />
    <circle cx="6.25" cy="5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="10" cy="11" r="1.6" fill="currentColor" stroke="none" />
  </svg>
)

export const UndoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4.5 7.5H11a2.75 2.75 0 010 5.5H9" />
    <path d="M7 4.5L4.5 7.5 7 10.5" />
  </svg>
)

export const RedoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M11.5 7.5H5a2.75 2.75 0 000 5.5h2" />
    <path d="M9 4.5L11.5 7.5 9 10.5" />
  </svg>
)

export const HistoryIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3.5l2.25 1.25" />
  </svg>
)

export const TidyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="1.5" y="4" width="5" height="4" rx="1" />
    <rect x="9.5" y="3" width="5" height="6" rx="1" />
    <path d="M6.5 6h3" />
  </svg>
)
