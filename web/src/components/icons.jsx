/**
 * The app's icons: inline SVG, one family, single 1.5px stroke weight, drawn on
 * a 24px grid and sized by the `size` prop. No icon font, no emoji.
 *
 * They inherit `currentColor`, so an icon takes the colour of the text it sits
 * beside without any per-icon styling.
 */

/** @param {{ size?: number } & React.SVGProps<SVGSVGElement>} props */
function Icon({ size = 16, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/**
 * The brand mark: a bowl, reduced to an arc and a rule.
 *
 * Abstract on purpose — a fork or an apple would date the product and read as
 * clip art. This is a geometric glyph that works at 20px and in one colour.
 */
export function BrandMark({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="brand-mark"
    >
      <path
        d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 3.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" />
    </svg>
  );
}

export const TodayIcon = (props) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);

export const HistoryIcon = (props) => (
  <Icon {...props}>
    <path d="M3 6h18M3 12h18M3 18h12" />
  </Icon>
);

export const ReportsIcon = (props) => (
  <Icon {...props}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);

export const GoalsIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const ChatIcon = (props) => (
  <Icon {...props}>
    <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
  </Icon>
);

export const ImportIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3v12M8 11l4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Icon>
);

export const PlusIcon = (props) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const CloseIcon = (props) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const CheckIcon = (props) => (
  <Icon {...props}>
    <path d="M4 12.5 9 17.5 20 6.5" />
  </Icon>
);

export const AlertIcon = (props) => (
  <Icon {...props}>
    <path d="M12 8v5M12 16.5v.5" />
    <circle cx="12" cy="12" r="9" />
  </Icon>
);

export const TrashIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Icon>
);

/** Source glyphs: how an entry got into the database. */
export const PencilIcon = (props) => (
  <Icon {...props}>
    <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4Z" />
  </Icon>
);

export const CameraIcon = (props) => (
  <Icon {...props}>
    <path d="M3 8h3l2-3h8l2 3h3v12H3V8Z" />
    <circle cx="12" cy="13" r="3.2" />
  </Icon>
);

export const SparkIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3.5c.6 3.4 1.8 5.5 5.2 6.1-3.4.6-4.6 2.7-5.2 6.1-.6-3.4-1.8-5.5-5.2-6.1 3.4-.6 4.6-2.7 5.2-6.1Z" />
    <path d="M17.5 15.5c.3 1.6.9 2.6 2.5 2.9-1.6.3-2.2 1.3-2.5 2.9-.3-1.6-.9-2.6-2.5-2.9 1.6-.3 2.2-1.3 2.5-2.9Z" />
  </Icon>
);

export const ChevronIcon = (props) => (
  <Icon {...props}>
    <path d="M8 10l4 4 4-4" />
  </Icon>
);

export const DocumentIcon = (props) => (
  <Icon {...props}>
    <path d="M6 3h8l4 4v14H6V3Z" />
    <path d="M14 3v4h4M9 13h6M9 17h6" />
  </Icon>
);
