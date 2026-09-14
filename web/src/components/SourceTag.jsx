import { CameraIcon, DocumentIcon, PencilIcon, SparkIcon } from './icons.jsx';

/**
 * How an entry got into the database.
 *
 * Provenance matters here: a number the model read off a photo deserves more
 * scepticism than one the user typed, so every listing says where it came from.
 */
const SOURCES = {
  manual: { Icon: PencilIcon, label: 'Typed in' },
  photo: { Icon: CameraIcon, label: 'From a photo' },
  chat: { Icon: SparkIcon, label: 'Via chat' },
  import: { Icon: DocumentIcon, label: 'Imported' },
};

/** @param {{ source: string, iconOnly?: boolean, size?: number }} props */
export function SourceTag({ source, iconOnly = false, size = 14 }) {
  const { Icon, label } = SOURCES[source] ?? SOURCES.manual;

  return (
    <span className="source-tag" title={iconOnly ? label : undefined}>
      <Icon size={size} />
      {iconOnly ? <span className="visually-hidden">{label}</span> : label}
    </span>
  );
}

/** The key shown above the History table, so the glyphs are not a guessing game. */
export function SourceLegend() {
  return (
    <div className="chart-legend">
      {Object.entries(SOURCES).map(([key, { Icon, label }]) => (
        <span className="chart-legend-item" key={key}>
          <Icon size={14} />
          {label}
        </span>
      ))}
    </div>
  );
}
